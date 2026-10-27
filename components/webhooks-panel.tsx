"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import type { ApplicationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS } from "@/components/status-badge";
import {
  createWebhookConfig,
  toggleWebhookConfig,
  deleteWebhookConfig,
  type CreateWebhookState,
} from "@/app/(app)/settings/webhook-actions";

const ALL_STATUSES: ApplicationStatus[] = [
  "WISHLIST",
  "APPLIED",
  "SCREEN",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];
const DEFAULT_TRIGGERS: ApplicationStatus[] = ["INTERVIEW", "OFFER", "REJECTED"];

export interface WebhookConfigRow {
  id: string;
  targetUrl: string;
  triggerOn: ApplicationStatus[];
  isActive: boolean;
}

export interface WebhookDeliveryRow {
  id: string;
  webhookConfigId: string;
  eventType: string;
  attemptNumber: number;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

export function WebhooksPanel({
  configs,
  deliveries,
}: {
  configs: WebhookConfigRow[];
  deliveries: WebhookDeliveryRow[];
}) {
  return (
    <div className="space-y-6">
      <CreateWebhookForm />
      <WebhookConfigList configs={configs} />
      <DeliveryLog deliveries={deliveries} />
    </div>
  );
}

function CreateWebhookForm() {
  const [state, formAction, isPending] = useActionState<CreateWebhookState, FormData>(
    createWebhookConfig,
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add webhook</CardTitle>
        <CardDescription>
          Fires a signed POST request when an application&apos;s status changes to one of the
          selected statuses. Point this at a Slack/Discord incoming webhook, a Zapier/Make
          catch hook, or your own endpoint.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetUrl">Target URL</Label>
            <Input
              id="targetUrl"
              name="targetUrl"
              type="url"
              placeholder="https://hooks.example.com/..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Trigger on</Label>
            <div className="flex flex-wrap gap-4">
              {ALL_STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    name="triggerOn"
                    value={status}
                    defaultChecked={DEFAULT_TRIGGERS.includes(status)}
                  />
                  {STATUS_LABELS[status]}
                </label>
              ))}
            </div>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding..." : "Add webhook"}
          </Button>
        </form>
        {state.secret ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium">Signing secret (shown once — copy it now):</p>
            <code className="mt-1 block break-all rounded bg-background p-2 text-xs">
              {state.secret}
            </code>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this to verify the <code>X-Webhook-Signature</code> header on your receiver.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WebhookConfigList({ configs }: { configs: WebhookConfigRow[] }) {
  const [isPending, startTransition] = useTransition();

  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No webhooks configured yet.
        </CardContent>
      </Card>
    );
  }

  function sendTest(configId: string) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/webhooks/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ configId }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Test webhook delivered.");
        } else {
          toast.error("Test delivery failed — check the log below.");
        }
      } catch {
        toast.error("Failed to send test webhook.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configured webhooks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {configs.map((config) => (
          <div
            key={config.id}
            className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <p className="break-all text-sm font-medium">{config.targetUrl}</p>
              <div className="flex flex-wrap gap-1">
                {config.triggerOn.map((s) => (
                  <Badge key={s} variant="secondary">
                    {STATUS_LABELS[s]}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => sendTest(config.id)}
              >
                Send test
              </Button>
              <Switch
                checked={config.isActive}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  startTransition(() => toggleWebhookConfig(config.id, checked))
                }
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteWebhookConfig(config.id);
                    toast.success("Webhook deleted.");
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DeliveryLog({ deliveries }: { deliveries: WebhookDeliveryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent deliveries</CardTitle>
        <CardDescription>Last 25 attempts across all webhooks, newest first.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {deliveries.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{d.eventType}</TableCell>
                  <TableCell className="text-sm">{d.attemptNumber}</TableCell>
                  <TableCell>
                    {d.success ? (
                      <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                        {d.statusCode ?? "OK"}
                      </Badge>
                    ) : (
                      <Badge className="border-0 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                        {d.statusCode ?? "Failed"}
                      </Badge>
                    )}
                    {d.errorMessage ? (
                      <p className="mt-1 text-xs text-muted-foreground">{d.errorMessage}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.durationMs != null ? `${d.durationMs}ms` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
