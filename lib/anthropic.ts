import Anthropic, { RateLimitError, APIError, AnthropicError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";

const globalForAnthropic = globalThis as unknown as { anthropic: Anthropic | undefined };

// Constructed lazily (not at module scope) so the app can build and run without
// ANTHROPIC_API_KEY set — it's only required when "Analyze posting" is actually used.
function getClient(): Anthropic {
  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return globalForAnthropic.anthropic;
}

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

export class JDAnalysisError extends Error {
  constructor(
    message: string,
    public readonly kind: "not_configured" | "rate_limit" | "api_error" | "invalid_output" | "unknown"
  ) {
    super(message);
    this.name = "JDAnalysisError";
  }
}

function buildSystemPrompt(resumeText: string, skills: string[]): string {
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
  ].join("\n");
}

export async function analyzeJobPosting(params: {
  jobPostingText: string;
  resumeText: string;
  skills: string[];
}): Promise<JDAnalysis> {
  const { jobPostingText, resumeText, skills } = params;

  let client: Anthropic;
  try {
    client = getClient();
  } catch {
    throw new JDAnalysisError(
      "ANTHROPIC_API_KEY is not set. Add it to .env to enable AI analysis.",
      "not_configured"
    );
  }

  try {
    const message = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system: buildSystemPrompt(resumeText, skills),
      messages: [{ role: "user", content: `Job posting:\n\n${jobPostingText}` }],
      output_config: { format: zodOutputFormat(jdAnalysisSchema) },
    });

    if (!message.parsed_output) {
      throw new JDAnalysisError(
        "Claude did not return structured output for this posting.",
        "invalid_output"
      );
    }

    return message.parsed_output;
  } catch (err) {
    if (err instanceof JDAnalysisError) throw err;
    if (err instanceof RateLimitError) {
      throw new JDAnalysisError("Claude is rate-limited right now. Try again shortly.", "rate_limit");
    }
    if (err instanceof APIError) {
      throw new JDAnalysisError(`Claude API error: ${err.message}`, "api_error");
    }
    if (err instanceof AnthropicError) {
      // Includes zodOutputFormat's own parse/validation failures (malformed or
      // schema-invalid JSON) — logged server-side for debugging, not shown raw to the user.
      console.error("JD analysis: structured output validation failed:", err.message);
      throw new JDAnalysisError(
        "Claude's response didn't match the expected format. This has been logged.",
        "invalid_output"
      );
    }
    console.error("JD analysis: unexpected error", err);
    throw new JDAnalysisError("Unexpected error analyzing this posting.", "unknown");
  }
}
