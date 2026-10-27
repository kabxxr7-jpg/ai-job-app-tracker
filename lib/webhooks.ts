import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import type { ApplicationStatus, Prisma } from "@prisma/client";

export interface StatusChangeEvent {
  applicationId: string;
  companyName: string;
  roleTitle: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
}

/**
 * Signs `timestamp + "." + body` (not just the body) so a receiver can enforce a replay
 * window, not just authenticity. Receivers should recompute this HMAC over the raw request
 * body and the `X-Webhook-Timestamp` header, then compare with `crypto.timingSafeEqual`
 * (never `===`, which is vulnerable to timing attacks). See README "Webhook Architecture".
 */
export function signPayload(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

async function deliverWebhook(params: {
  webhookConfigId: string;
  secret: string;
  targetUrl: string;
  applicationId: string;
  payload: Prisma.InputJsonValue;
  attemptNumber: number;
}) {
  const { webhookConfigId, secret, targetUrl, applicationId, payload, attemptNumber } = params;
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signature = signPayload(secret, timestamp, body);

  const start = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    statusCode = res.status;
    const text = await res.text();
    responseBody = text.slice(0, 2000);
    success = res.ok;
    if (!success) {
      errorMessage = `Non-2xx response: ${res.status}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown delivery error";
  }

  const durationMs = Date.now() - start;

  await prisma.webhookDelivery.create({
    data: {
      webhookConfigId,
      applicationId,
      eventType: "application.status_changed",
      payload,
      attemptNumber,
      statusCode,
      responseBody,
      success,
      errorMessage,
      durationMs,
      // M4 adds a cron-driven retry sweep that picks up rows with nextRetryAt set.
      nextRetryAt: success ? null : new Date(Date.now() + 30_000),
    },
  });

  return success;
}

export async function triggerWebhooksForStatusChange(event: StatusChangeEvent) {
  const configs = await prisma.webhookConfig.findMany({
    where: { isActive: true, triggerOn: { has: event.toStatus } },
  });

  if (configs.length === 0) return;

  const payload = {
    event: "application.status_changed",
    applicationId: event.applicationId,
    company: event.companyName,
    roleTitle: event.roleTitle,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    timestamp: new Date().toISOString(),
  };

  await Promise.all(
    configs.map((config) =>
      deliverWebhook({
        webhookConfigId: config.id,
        secret: config.secret,
        targetUrl: config.targetUrl,
        applicationId: event.applicationId,
        payload,
        attemptNumber: 1,
      })
    )
  );
}
