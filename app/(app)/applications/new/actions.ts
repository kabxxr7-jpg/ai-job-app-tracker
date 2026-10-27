"use server";

import { redirect } from "next/navigation";
import { createApplication } from "@/app/(app)/applications/actions";

export async function createApplicationFromForm(formData: FormData) {
  const companyName = String(formData.get("companyName") ?? "");
  const roleTitle = String(formData.get("roleTitle") ?? "");
  const jobPostingUrl = String(formData.get("jobPostingUrl") ?? "");
  const jobPostingText = String(formData.get("jobPostingText") ?? "");

  const application = await createApplication({
    companyName,
    roleTitle,
    jobPostingUrl,
    jobPostingText,
  });

  redirect(`/applications/${application.id}`);
}
