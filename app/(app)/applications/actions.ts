"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { ApplicationStatus } from "@prisma/client";
import { triggerWebhooksForStatusChange } from "@/lib/webhooks";

export async function createApplication(input: {
  companyName: string;
  roleTitle: string;
  jobPostingUrl?: string;
  jobPostingText?: string;
}) {
  const companyName = input.companyName.trim();
  const roleTitle = input.roleTitle.trim();
  if (!companyName || !roleTitle) {
    throw new Error("Company and role are required.");
  }

  const company = await prisma.company.upsert({
    where: { name: companyName },
    update: {},
    create: { name: companyName },
  });

  const application = await prisma.application.create({
    data: {
      companyId: company.id,
      roleTitle,
      jobPostingUrl: input.jobPostingUrl?.trim() || null,
      jobPostingText: input.jobPostingText?.trim() || null,
    },
  });

  await prisma.statusEvent.create({
    data: {
      applicationId: application.id,
      fromStatus: null,
      toStatus: application.status,
    },
  });

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  return application;
}

/**
 * Single code path for every status transition in the app (kanban drag, detail-page
 * dropdown, etc.) so the StatusEvent write and webhook trigger can never drift out of
 * sync between entry points.
 */
export async function updateApplicationStatus(
  applicationId: string,
  toStatus: ApplicationStatus,
  note?: string
) {
  const current = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { company: true },
  });

  if (current.status === toStatus) {
    return current;
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: toStatus,
      appliedAt:
        toStatus === "APPLIED" && !current.appliedAt ? new Date() : current.appliedAt,
    },
  });

  await prisma.statusEvent.create({
    data: {
      applicationId,
      fromStatus: current.status,
      toStatus,
      note: note?.trim() || null,
    },
  });

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/dashboard");

  // Fire-and-log webhook deliveries for matching configs. Awaited (not `void`) so delivery
  // rows are written before this request completes — see README "Webhook Architecture".
  await triggerWebhooksForStatusChange({
    applicationId,
    companyName: current.company.name,
    roleTitle: current.roleTitle,
    fromStatus: current.status,
    toStatus,
  });

  return updated;
}

export async function addNote(applicationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;

  await prisma.note.create({
    data: { applicationId, body: trimmed },
  });

  revalidatePath(`/applications/${applicationId}`);
}

export async function listApplications() {
  return prisma.application.findMany({
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });
}
