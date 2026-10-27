"use server";

import { revalidatePath } from "next/cache";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/profile";
import { analyzeJobPosting, type JDAnalysis } from "@/lib/anthropic";
import { updateApplicationStatus as updateApplicationStatusShared, addNote as addNoteShared } from "@/app/(app)/applications/actions";

export async function changeStatus(applicationId: string, toStatus: ApplicationStatus) {
  await updateApplicationStatusShared(applicationId, toStatus);
}

export async function submitNote(applicationId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "");
  await addNoteShared(applicationId, body);
  revalidatePath(`/applications/${applicationId}`);
}

export async function analyzePosting(applicationId: string, jobPostingText: string): Promise<JDAnalysis> {
  const trimmed = jobPostingText.trim();
  if (!trimmed) {
    throw new Error("Paste the job description first.");
  }

  await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  const profile = await getOrCreateProfile();

  const analysis = await analyzeJobPosting({
    jobPostingText: trimmed,
    resumeText: profile.resumeText,
    skills: profile.skills,
  });

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      jobPostingText: trimmed,
      seniority: analysis.seniority,
      location: analysis.location,
      tags: analysis.tags,
      fitScore: analysis.fitScore,
      fitRationale: analysis.fitRationale,
      outreachDraft: analysis.outreachDraft,
    },
  });

  revalidatePath(`/applications/${applicationId}`);
  return analysis;
}
