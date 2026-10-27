import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { StatusSelect } from "@/components/status-select";
import { STATUS_LABELS } from "@/components/status-badge";
import { AnalyzePosting } from "@/components/analyze-posting";
import { changeStatus, submitNote, analyzePosting } from "./actions";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      company: true,
      notes: { orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!application) {
    notFound();
  }

  const addNoteAction = submitNote.bind(null, application.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <h1 className="text-2xl font-semibold">{application.roleTitle}</h1>
          <p className="text-muted-foreground">{application.company.name}</p>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Status</CardTitle>
            <StatusSelect applicationId={application.id} status={application.status} onChange={changeStatus} />
          </CardHeader>
          <CardContent>
            {application.jobPostingUrl ? (
              <p className="text-sm">
                Posting:{" "}
                <a href={application.jobPostingUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {application.jobPostingUrl}
                </a>
              </p>
            ) : null}
            {application.location ? (
              <p className="text-sm text-muted-foreground">Location: {application.location}</p>
            ) : null}
            {application.seniority ? (
              <p className="text-sm text-muted-foreground">Seniority: {application.seniority}</p>
            ) : null}
            {application.tags.length > 0 ? (
              <p className="text-sm text-muted-foreground">Tags: {application.tags.join(", ")}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyzePosting
              applicationId={application.id}
              initialJobPostingText={application.jobPostingText ?? ""}
              initialAnalysis={{
                fitScore: application.fitScore,
                fitRationale: application.fitRationale,
                outreachDraft: application.outreachDraft,
                seniority: application.seniority,
                location: application.location,
                tags: application.tags,
              }}
              onAnalyze={analyzePosting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={addNoteAction} className="space-y-2">
              <Textarea name="body" placeholder="Add a note..." rows={3} required />
              <Button type="submit" size="sm">
                Add note
              </Button>
            </form>
            <Separator />
            <div className="space-y-3">
              {application.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                application.notes.map((note) => (
                  <div key={note.id} className="text-sm">
                    <p>{note.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {note.createdAt.toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {application.statusEvents.map((event) => (
              <div key={event.id} className="text-sm">
                <p className="font-medium">
                  {event.fromStatus ? `${STATUS_LABELS[event.fromStatus]} → ` : "Created as "}
                  {STATUS_LABELS[event.toStatus]}
                </p>
                <p className="text-xs text-muted-foreground">{event.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
