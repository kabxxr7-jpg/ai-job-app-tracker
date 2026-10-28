import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";

const globalForGemini = globalThis as unknown as { gemini: GoogleGenAI | undefined };

// Constructed lazily (not at module scope) so the app can build and run without
// GEMINI_API_KEY set — it's only required when "Analyze posting" is actually used.
function getClient(): GoogleGenAI {
  if (!globalForGemini.gemini) {
    globalForGemini.gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return globalForGemini.gemini;
}

// flash-lite over flash: this is a single structured-extraction call, not a task that needs the
// heaviest model, and the lite tier has proven more available under free-tier load in testing.
const MODEL = "gemini-flash-lite-latest";

export const SENIORITY_LEVELS = [
  "intern",
  "junior",
  "mid",
  "senior",
  "staff",
  "lead",
  "manager",
  "unknown",
] as const;

export const jdAnalysisSchema = z.object({
  company: z.string(),
  roleTitle: z.string(),
  seniority: z.enum(SENIORITY_LEVELS),
  location: z.string().nullable(),
  keyRequirements: z.array(z.string()),
  tags: z.array(z.string()),
  fitScore: z.number().int().min(0).max(100),
  fitRationale: z.string(),
  outreachDraft: z.string(),
});

export type JDAnalysis = z.infer<typeof jdAnalysisSchema>;

// Gemini's responseJsonSchema wants a plain JSON Schema object, derived here from the same
// Zod schema used to validate the response below — one source of truth for the shape.
const jdAnalysisJsonSchema = z.toJSONSchema(jdAnalysisSchema);

export class JDAnalysisError extends Error {
  constructor(
    message: string,
    public readonly kind: "not_configured" | "rate_limit" | "api_error" | "invalid_output" | "unknown"
  ) {
    super(message);
    this.name = "JDAnalysisError";
  }
}

function buildPrompt(jobPostingText: string, resumeText: string, skills: string[]): string {
  return [
    "You are a job-application analyst helping a candidate evaluate a job posting against their background.",
    "Read the job description and the candidate's resume/skills below, then extract structured fields and produce an honest fit assessment.",
    "",
    "Candidate resume:",
    resumeText || "(no resume on file)",
    "",
    `Candidate skills: ${skills.length > 0 ? skills.join(", ") : "(none listed)"}`,
    "",
    "Scoring guidance: fitScore is 0-100 reflecting how well the candidate's background matches this specific posting's",
    "seniority and requirements. Be honest and specific in fitRationale — don't inflate the score. outreachDraft should be a",
    "short (3-5 sentence), specific, non-generic note the candidate could send to a recruiter or hiring manager for this role.",
    "",
    "Job posting:",
    "",
    jobPostingText,
  ].join("\n");
}

export async function analyzeJobPosting(params: {
  jobPostingText: string;
  resumeText: string;
  skills: string[];
}): Promise<JDAnalysis> {
  const { jobPostingText, resumeText, skills } = params;

  let client: GoogleGenAI;
  try {
    client = getClient();
  } catch {
    throw new JDAnalysisError(
      "GEMINI_API_KEY is not set. Add it to .env to enable AI analysis.",
      "not_configured"
    );
  }

  let rawText: string | undefined;
  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: buildPrompt(jobPostingText, resumeText, skills),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jdAnalysisJsonSchema,
      },
    });

    rawText = response.text;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 429) {
        throw new JDAnalysisError("Gemini is rate-limited right now. Try again shortly.", "rate_limit");
      }
      if (err.status === 503) {
        throw new JDAnalysisError(
          "Gemini is temporarily overloaded. Try again in a moment.",
          "api_error"
        );
      }
      throw new JDAnalysisError(`Gemini API error (${err.status}). Try again shortly.`, "api_error");
    }
    console.error("JD analysis: unexpected error", err);
    throw new JDAnalysisError("Unexpected error analyzing this posting.", "unknown");
  }

  if (!rawText) {
    throw new JDAnalysisError("Gemini did not return any output for this posting.", "invalid_output");
  }

  // Defense-in-depth: Gemini's responseJsonSchema constrains the model's output, but a
  // schema-constrained response can still fail validation (wrong type, missing field) — never
  // trust an external API response blindly, even a "structured" one.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("JD analysis: failed to parse Gemini output as JSON:", rawText);
    throw new JDAnalysisError(
      "Gemini's response wasn't valid JSON. This has been logged.",
      "invalid_output"
    );
  }

  const result = jdAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    console.error("JD analysis: structured output failed schema validation:", result.error.message);
    throw new JDAnalysisError(
      "Gemini's response didn't match the expected format. This has been logged.",
      "invalid_output"
    );
  }

  return result.data;
}
