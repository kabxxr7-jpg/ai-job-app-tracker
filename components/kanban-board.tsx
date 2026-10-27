"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import type { ApplicationStatus } from "@prisma/client";
import { KanbanColumn } from "@/components/kanban-column";
import type { KanbanApplication } from "@/components/kanban-card";
import { STATUS_LABELS } from "@/components/status-badge";

const COLUMN_ORDER: ApplicationStatus[] = [
  "WISHLIST",
  "APPLIED",
  "SCREEN",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

export function KanbanBoard({
  applications,
  onStatusChange,
}: {
  applications: KanbanApplication[];
  onStatusChange: (applicationId: string, status: ApplicationStatus) => Promise<void>;
}) {
  const [optimisticApplications, moveOptimistic] = useOptimistic(
    applications,
    (state, { id, status }: { id: string; status: ApplicationStatus }) =>
      state.map((a) => (a.id === id ? { ...a, status } : a))
  );
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const newStatus = over.id as ApplicationStatus;
    const application = applications.find((a) => a.id === active.id);
    if (!application || application.status === newStatus) return;

    startTransition(async () => {
      moveOptimistic({ id: application.id, status: newStatus });
      try {
        await onStatusChange(application.id, newStatus);
        toast.success(`Moved to ${STATUS_LABELS[newStatus]}`);
      } catch {
        toast.error("Failed to update status.");
      }
    });
  }

  const grouped = COLUMN_ORDER.reduce<Record<ApplicationStatus, KanbanApplication[]>>(
    (acc, status) => {
      acc[status] = optimisticApplications.filter((a) => a.status === status);
      return acc;
    },
    {} as Record<ApplicationStatus, KanbanApplication[]>
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn key={status} status={status} applications={grouped[status]} />
        ))}
      </div>
    </DndContext>
  );
}
