"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ApplicationStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/components/status-badge";
import { KanbanCard, type KanbanApplication } from "@/components/kanban-card";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  status,
  applications,
}: {
  status: ApplicationStatus;
  applications: KanbanApplication[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2 transition-colors",
        isOver && "bg-muted/60 ring-2 ring-ring/40"
      )}
    >
      <div className="flex items-center justify-between px-1 pt-1">
        <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
        <span className="text-xs text-muted-foreground">{applications.length}</span>
      </div>
      <div className="flex min-h-[60px] flex-col gap-2">
        {applications.map((app) => (
          <KanbanCard key={app.id} application={app} />
        ))}
      </div>
    </div>
  );
}
