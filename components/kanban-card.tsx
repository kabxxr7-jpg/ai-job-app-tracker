"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ApplicationStatus } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";

export interface KanbanApplication {
  id: string;
  roleTitle: string;
  companyName: string;
  status: ApplicationStatus;
  fitScore: number | null;
}

export function KanbanCard({ application }: { application: KanbanApplication }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab touch-none py-0 active:cursor-grabbing"
    >
      <CardContent className="space-y-1 p-3">
        <Link
          href={`/applications/${application.id}`}
          className="block text-sm font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {application.roleTitle}
        </Link>
        <p className="text-xs text-muted-foreground">{application.companyName}</p>
        {application.fitScore != null ? (
          <p className="text-xs font-medium text-primary">Fit: {application.fitScore}/100</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
