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

/**
 * Backoff schedule for the attempt that just failed: attempt 1 fails -> retry (attempt 2)
 * in 30s; attempt 2 fails -> retry (attempt 3) in 5min; attempt 3 fails -> give up.
 */
function nextRetryDelayMs(failedAttemptNumber: number): number | null {
  if (failedAttemptNumber === 1) return 30_000;
  if (failedAttemptNumber === 2) return 5 * 60_000;
  return null;
}

export async function deliverWebhook(params: {
  webhookConfigId: string;
  secret: string;
  targetUrl: string;
  applicationId: string | null;
  eventType: string;
  payload: Prisma.InputJsonValue;
  attemptNumber: number;
}) {
  const { webhookConfigId, secret, targetUrl, applicationId, eventType, payload, attemptNumber } = params;
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
      eventType,
      payload,
      attemptNumber,
      statusCode,
      responseBody,
      success,
      errorMessage,
      durationMs,
      nextRetryAt: (() => {
        if (success) return null;
        const delay = nextRetryDelayMs(attemptNumber);
        return delay != null ? new Date(Date.now() + delay) : null;
      })(),
    },
  });

  return success;
}

/**
 * Cron-driven retry sweep: re-attempts failed deliveries whose backoff window has elapsed.
 * Decoupled from the original request so delivery isn't bound by a serverless function's
 * execution window, and a receiver's transient outage doesn't permanently drop an event.
 */
export async function retryFailedDeliveries(): Promise<{ attempted: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: { success: false, attemptNumber: { lt: 3 }, nextRetryAt: { lte: new Date() } },
    include: { webhookConfig: true },
  });

  let attempted = 0;
  for (const delivery of due) {
    if (!delivery.webhookConfig.isActive) continue;
    attempted += 1;
    await deliverWebhook({
      webhookConfigId: delivery.webhookConfigId,
      secret: delivery.webhookConfig.secret,
      targetUrl: delivery.webhookConfig.targetUrl,
      applicationId: delivery.applicationId,
      eventType: delivery.eventType,
      payload: delivery.payload as Prisma.InputJsonValue,
      attemptNumber: delivery.attemptNumber + 1,
    });
  }

  return { attempted };
}

export async function triggerWebhooksForStatusChange(event: StatusChangeEvent) {
  const configs = await prisma.webhookConfig.findMany({
    where: { isActive: true, triggerOn: { has: event.toStatus } },
  });

  if (configs.length === 0) return;

  const eventType = "application.status_changed";
  const payload = {
    event: eventType,
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
        eventType,
        payload,
        attemptNumber: 1,
      })
    )
  );
}
