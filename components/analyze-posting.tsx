"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { JDAnalysis } from "@/lib/anthropic";

export interface AnalyzePostingProps {
  applicationId: string;
  initialJobPostingText: string;
  initialAnalysis: {
    fitScore: number | null;
    fitRationale: string | null;
    outreachDraft: string | null;
    seniority: string | null;
    location: string | null;
    tags: string[];
  };
  onAnalyze: (applicationId: string, jobPostingText: string) => Promise<JDAnalysis>;
}

export function AnalyzePosting({
  applicationId,
  initialJobPostingText,
  initialAnalysis,
  onAnalyze,
}: AnalyzePostingProps) {
  const [jdText, setJdText] = useState(initialJobPostingText);
  const [analysis, setAnalysis] = useState<JDAnalysis | null>(
    initialAnalysis.fitScore != null
      ? {
          company: "",
          roleTitle: "",
          seniority: (initialAnalysis.seniority as JDAnalysis["seniority"]) ?? "unknown",
          location: initialAnalysis.location,
          keyRequirements: [],
          tags: initialAnalysis.tags,
          fitScore: initialAnalysis.fitScore,
          fitRationale: initialAnalysis.fitRationale ?? "",
          outreachDraft: initialAnalysis.outreachDraft ?? "",
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!analysis);
  const [isPending, startTransition] = useTransition();

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onAnalyze(applicationId, jdText);
        setAnalysis(result);
        setShowForm(false);
        toast.success("Analysis complete.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to analyze posting.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {analysis && !showForm ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Progress value={analysis.fitScore} className="h-2 flex-1" />
            <span className="text-sm font-semibold">{analysis.fitScore}/100</span>
          </div>
          <p className="text-sm text-muted-foreground">{analysis.fitRationale}</p>
          {analysis.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {analysis.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Outreach draft</p>
            <Textarea readOnly rows={4} value={analysis.outreachDraft} className="text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Re-analyze
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={8}
            placeholder="Paste the job description here..."
            disabled={isPending}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button onClick={handleAnalyze} disabled={isPending || !jdText.trim()}>
              {isPending ? "Analyzing..." : "Analyze posting"}
            </Button>
            {analysis ? (
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isPending}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
