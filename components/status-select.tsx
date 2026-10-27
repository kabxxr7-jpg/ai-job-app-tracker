"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ApplicationStatus } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS } from "@/components/status-badge";

const STATUSES: ApplicationStatus[] = [
  "WISHLIST",
  "APPLIED",
  "SCREEN",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

export function StatusSelect({
  applicationId,
  status,
  onChange,
}: {
  applicationId: string;
  status: ApplicationStatus;
  onChange: (applicationId: string, status: ApplicationStatus) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={isPending}
      onValueChange={(value) => {
        startTransition(async () => {
          try {
            await onChange(applicationId, value as ApplicationStatus);
            toast.success(`Status updated to ${STATUS_LABELS[value as ApplicationStatus]}`);
          } catch {
            toast.error("Failed to update status.");
          }
        });
      }}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue>{(value: ApplicationStatus) => STATUS_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
