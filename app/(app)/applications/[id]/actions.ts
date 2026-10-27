"use server";

import { revalidatePath } from "next/cache";
import type { ApplicationStatus } from "@prisma/client";
import { updateApplicationStatus as updateApplicationStatusShared, addNote as addNoteShared } from "@/app/(app)/applications/actions";

export async function changeStatus(applicationId: string, toStatus: ApplicationStatus) {
  await updateApplicationStatusShared(applicationId, toStatus);
}

export async function submitNote(applicationId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "");
  await addNoteShared(applicationId, body);
  revalidatePath(`/applications/${applicationId}`);
}
