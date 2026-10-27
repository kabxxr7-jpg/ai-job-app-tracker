import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deliverWebhook } from "@/lib/webhooks";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const configId = body?.configId;
  if (typeof configId !== "string") {
    return NextResponse.json({ error: "configId is required" }, { status: 400 });
  }

  const config = await prisma.webhookConfig.findUnique({ where: { id: configId } });
  if (!config) {
    return NextResponse.json({ error: "Webhook config not found" }, { status: 404 });
  }

  const success = await deliverWebhook({
    webhookConfigId: config.id,
    secret: config.secret,
    targetUrl: config.targetUrl,
    applicationId: null,
    eventType: "webhook.test",
    payload: {
      event: "webhook.test",
      message: "This is a test delivery from AI Job Application Tracker.",
      timestamp: new Date().toISOString(),
    },
    attemptNumber: 1,
  });

  return NextResponse.json({ success });
}
