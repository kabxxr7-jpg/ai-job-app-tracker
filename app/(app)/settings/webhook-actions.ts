"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface CreateWebhookState {
  error?: string;
  secret?: string;
}

export async function createWebhookConfig(
  _prevState: CreateWebhookState,
  formData: FormData
): Promise<CreateWebhookState> {
  const targetUrl = String(formData.get("targetUrl") ?? "").trim();
  if (!targetUrl) return { error: "Target URL is required." };

  try {
    new URL(targetUrl);
  } catch {
    return { error: "Enter a valid URL, including https://." };
  }

  const triggerOn = formData.getAll("triggerOn") as ApplicationStatus[];
  if (triggerOn.length === 0) return { error: "Select at least one trigger status." };

  const secret = crypto.randomBytes(24).toString("hex");

  await prisma.webhookConfig.create({
    data: { targetUrl, secret, triggerOn },
  });

  revalidatePath("/settings");
  return { secret };
}

export async function toggleWebhookConfig(id: string, isActive: boolean) {
  await prisma.webhookConfig.update({ where: { id }, data: { isActive } });
  revalidatePath("/settings");
}

export async function deleteWebhookConfig(id: string) {
  await prisma.webhookDelivery.deleteMany({ where: { webhookConfigId: id } });
  await prisma.webhookConfig.delete({ where: { id } });
  revalidatePath("/settings");
}
