"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/profile";

export async function updateProfile(formData: FormData) {
  const resumeText = String(formData.get("resumeText") ?? "").trim();
  const skillsRaw = String(formData.get("skills") ?? "");
  const skills = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const profile = await getOrCreateProfile();
  await prisma.profile.update({
    where: { id: profile.id },
    data: { resumeText, skills },
  });

  revalidatePath("/settings");
}
