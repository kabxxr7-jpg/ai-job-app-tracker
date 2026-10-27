import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  WISHLIST: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  APPLIED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  SCREEN: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  INTERVIEW: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
  OFFER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  WITHDRAWN: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  WISHLIST: "Wishlist",
  APPLIED: "Applied",
  SCREEN: "Screen",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge className={cn("border-0 font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
