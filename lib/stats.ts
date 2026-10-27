import { prisma } from "@/lib/db";
import type { ApplicationStatus } from "@prisma/client";

const RESPONDED_STATUSES: ApplicationStatus[] = ["SCREEN", "INTERVIEW", "OFFER", "REJECTED"];

export interface DashboardStats {
  total: number;
  appliedCount: number;
  respondedCount: number;
  responseRate: number | null; // percentage, 0-100, null if no applications submitted yet
  medianResponseDays: number | null;
  funnel: Record<ApplicationStatus, number>;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const applications = await prisma.application.findMany({
    select: { id: true, status: true },
  });

  const total = applications.length;
  const appliedCount = applications.filter((a) => a.status !== "WISHLIST").length;
  const respondedCount = applications.filter((a) =>
    RESPONDED_STATUSES.includes(a.status)
  ).length;
  const responseRate = appliedCount > 0 ? (respondedCount / appliedCount) * 100 : null;

  const funnel = {
    WISHLIST: 0,
    APPLIED: 0,
    SCREEN: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  } satisfies Record<ApplicationStatus, number>;
  for (const app of applications) {
    funnel[app.status] += 1;
  }

  const events = await prisma.statusEvent.findMany({
    orderBy: { createdAt: "asc" },
    select: { applicationId: true, toStatus: true, createdAt: true },
  });

  const eventsByApplication = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByApplication.get(event.applicationId) ?? [];
    list.push(event);
    eventsByApplication.set(event.applicationId, list);
  }

  const responseDays: number[] = [];
  for (const appEvents of eventsByApplication.values()) {
    const appliedIndex = appEvents.findIndex((e) => e.toStatus === "APPLIED");
    if (appliedIndex === -1) continue;
    const next = appEvents
      .slice(appliedIndex + 1)
      .find((e) => RESPONDED_STATUSES.includes(e.toStatus));
    if (!next) continue;
    const days =
      (next.createdAt.getTime() - appEvents[appliedIndex].createdAt.getTime()) /
      (1000 * 60 * 60 * 24);
    responseDays.push(days);
  }

  return {
    total,
    appliedCount,
    respondedCount,
    responseRate,
    medianResponseDays: median(responseDays),
    funnel,
  };
}
