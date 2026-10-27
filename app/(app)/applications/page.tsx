import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban-board";
import { updateApplicationStatus } from "./actions";

export default async function ApplicationsPage() {
  const applications = await prisma.application.findMany({
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });

  const kanbanApplications = applications.map((app) => ({
    id: app.id,
    roleTitle: app.roleTitle,
    companyName: app.company.name,
    status: app.status,
    fitScore: app.fitScore,
  }));

  async function onStatusChange(applicationId: string, status: ApplicationStatus) {
    "use server";
    await updateApplicationStatus(applicationId, status);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <Button render={<Link href="/applications/new" />} nativeButton={false}>
          New application
        </Button>
      </div>

      {applications.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No applications yet.{" "}
          <Link href="/applications/new" className="underline">
            Add your first one
          </Link>
          .
        </p>
      ) : (
        <KanbanBoard applications={kanbanApplications} onStatusChange={onStatusChange} />
      )}
    </div>
  );
}
