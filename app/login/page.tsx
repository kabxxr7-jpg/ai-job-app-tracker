"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/dashboard";
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => login(formData),
    {}
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>AI Job Application Tracker</CardTitle>
          <CardDescription>Single-user app. Enter the access password.</CardDescription>
        </CardHeader>
        <CardContent>
          {process.env.NEXT_PUBLIC_DEMO_HINT ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              This is a live portfolio demo. Password:{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono">
                {process.env.NEXT_PUBLIC_DEMO_HINT}
              </code>
            </div>
          ) : null}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="from" value={from} />
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoFocus />
            </div>
            {state?.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
