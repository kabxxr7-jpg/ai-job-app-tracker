# AI Job Application Tracker

**Live demo: [ai-job-app-tracker.vercel.app](https://ai-job-app-tracker.vercel.app)** — password shown right on the login screen, no need to ask.

A job application tracker with two things that actually matter for client work, built deep instead
of wide:

- **AI that does something real** — paste a job posting, Gemini reads it against your resume and
  returns a fit score, a rationale, and a drafted outreach note, using structured output validated
  server-side (not a prompt-and-hope wrapper).
- **Integrations that actually fire** — status changes trigger signed, logged, automatically-retried
  webhooks to any HTTPS endpoint you configure (Slack, Discord, Zapier and Make need a payload adapter). Every delivery attempt is recorded; failed
  ones retry on a backoff schedule until they succeed or give up.

Everything else — the kanban board, dashboard stats, notes, timeline — exists to make those two
features feel like part of a real product instead of a script with a UI slapped on.

*Full technical writeup below, including the HMAC signing scheme and how the retry sweep was
verified end-to-end. Skip ahead if you just want to see it work.*

## Architecture

```
Next.js App Router (Server Actions + Route Handlers)
        |
        |-- Postgres (Prisma) ---- companies, applications, status history, notes,
        |                          resume profile, webhook configs + delivery log
        |
        |-- Gemini API ----------- structured JD extraction + fit scoring
        |                          (responseJsonSchema + Zod validation)
        |
        '-- Outgoing webhooks ---- signed POSTs to any HTTPS endpoint you
                                    configure, on status change
```

Every page is a Server Component reading Postgres directly via Prisma. Mutations are Server Actions
colocated with their page (`actions.ts` files) — the only real API routes are the two things that
*have* to be HTTP endpoints: the Vercel Cron target (`/api/cron/retry-webhooks`) and a manual
"send test webhook" trigger (`/api/webhooks/test`).

## Tech choices, and why

- **Prisma over Drizzle** — migration ergonomics (`prisma migrate dev`) and generated types got a
  CRUD + seed story working fastest for a time-boxed build. Drizzle would be the pick for an
  edge-first or perf-critical deployment.
- **A single `APP_PASSWORD` cookie gate instead of Clerk/NextAuth** — this app has exactly one user
  (me). Reaching for an auth provider here would be ceremony, not value. `proxy.ts` (Next 16's
  rename of middleware) checks a signed, httpOnly JWT cookie on every request; `lib/auth.ts` signs
  it with `jose`. A real multi-tenant version would swap this for Clerk/NextAuth without touching
  the data layer — nothing is `userId`-scoped because there's only one user.
- **Server Actions over API routes** for every form/mutation — idiomatic App Router, keeps the
  Gemini API key and webhook secrets server-side with zero extra plumbing.
- **shadcn/ui on Base UI** (not Radix) with Tailwind v4, hand-rolled kanban via `@dnd-kit/core`
  rather than a kanban library.
- **Postgres via Supabase** in production (pooled `DATABASE_URL` for the app, direct `DIRECT_URL`
  for migrations — see `.env.example`); plain local Postgres in development.

## The AI feature: JD extraction + fit scoring

On an application's detail page, paste a job description and Gemini returns, in one call:
extracted fields (seniority, location, requirement tags), a 0–100 fit score against your stored
resume/skills, a one-paragraph rationale, and a tailored outreach-note draft.

This uses Gemini's structured-output mode (`responseMimeType: "application/json"` +
`responseJsonSchema`, see `lib/ai.ts`) — not a prompt that says "respond in JSON" and a regex to
scrape the reply. The JSON Schema sent to Gemini is derived from a Zod schema (`z.toJSONSchema`),
and the response is parsed and validated against that *same* Zod schema before any of it reaches
the database. That's defense-in-depth that's easy to skip: a schema-constrained response can still
come back malformed or fail validation (wrong type, missing field), so it's never trusted blindly
just because the provider promised structured output — `jdAnalysisSchema.safeParse()` is the real
gate, not the API call.

Errors are categorized into a `JDAnalysisError` (`not_configured` / `rate_limit` / `api_error` /
`invalid_output` / `unknown`) so the UI shows a clean, specific message instead of a stack trace —
"Gemini is rate-limited, try again shortly" reads very differently from "this has been logged," and
a user shouldn't have to guess which one they're looking at. The Gemini client is constructed
lazily (not at module load) so the app builds and runs fine without `GEMINI_API_KEY` set; only the
analyze action needs it. Gemini's free tier (no card required) is what this project runs on —
swapping in a paid tier, or a different provider entirely, only touches `lib/ai.ts`.

Streaming was considered and skipped: this is a single-shot structured extraction, not a
conversational reply, so there's nothing to stream — using it anyway would be reaching for a tool
because it exists, not because the feature needs it.

## The webhook feature: signed, logged, retried

Settings → Webhooks lets you point a URL (any HTTPS endpoint; Slack and Discord incoming webhooks and
Zapier/Make catch hooks would need a small payload adapter, which this does not include) at specific status transitions (default: Interview, Offer, Rejected). On a
matching status change, `lib/webhooks.ts` POSTs a signed JSON payload and logs every attempt —
not just failures — to `WebhookDelivery`.

**Signing:** `X-Webhook-Signature: sha256=<hex>` is an HMAC-SHA256 over `timestamp + "." + body`
(not just the body), with the timestamp also sent as `X-Webhook-Timestamp`. Signing the timestamp
alongside the body means a receiver can enforce a replay window, not just check authenticity. A
receiver should verify like this:

```js
const expected = crypto
  .createHmac("sha256", secret)
  .update(`${timestampHeader}.${rawBody}`)
  .digest("hex");

const valid =
  crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSignature)) &&
  Date.now() - new Date(timestampHeader).getTime() < 5 * 60 * 1000; // reject if older than 5min
```

Always use `crypto.timingSafeEqual` for the comparison, never `===` — a naive string comparison
leaks timing information an attacker can use to guess the signature byte by byte.

**Delivery + retry:** every attempt (success or failure) is logged with status code, response
snippet, duration, and error message. A failed delivery schedules a retry: 30s after attempt 1,
5 minutes after attempt 2, then gives up after attempt 3. The retry sweep
(`/api/cron/retry-webhooks`, wired to `vercel.json`'s cron schedule) re-attempts due deliveries on
its own cadence — decoupled from the original request, so delivery isn't bound by a serverless
function's execution window and a receiver's transient outage doesn't permanently drop an event.
This was verified end-to-end against a local HTTP listener during development: a signed delivery
was received and the HMAC independently recomputed to confirm it matched, then a broken-URL config
was used to confirm a failed delivery gets logged and picked up by the retry sweep with an
incremented attempt number once its backoff window elapses.

Status changes all go through one function — `updateApplicationStatus()` in
`app/(app)/applications/actions.ts` — called from both the kanban drag handler and the detail
page's dropdown. The `StatusEvent` write and the webhook trigger live in that one place, so they
can't drift out of sync between UI entry points the way they would if each entry point duplicated
the logic.

## Setup

```bash
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, GEMINI_API_KEY, APP_PASSWORD, SESSION_SECRET
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

`.env.example` documents every variable and where to get it. `lib/env.ts` throws a clear error
(not a cryptic failure three layers deep) the moment a required variable is actually accessed and
missing, rather than a scattering of unchecked `process.env.X` calls.

### Deploying

1. Create a Supabase project; use the pooled connection string as `DATABASE_URL` and the direct
   connection string as `DIRECT_URL`.
2. Set all `.env.example` variables in Vercel's project settings, including `CRON_SECRET` (any
   random string). Vercel automatically sends it as the `Authorization: Bearer <CRON_SECRET>`
   header on cron invocations, which the route checks, so stray requests can't trigger the retry
   sweep.
3. `npx prisma migrate deploy` against the production database, then `npm run db:seed` if you want
   non-empty demo data.
4. Deploy. `vercel.json`'s cron schedule picks up automatically. It runs once daily
   (`0 3 * * *`) because Vercel's Hobby tier rejects any cron expression that would fire more than
   once per day — confirmed by an actual deploy rejection, not a guess. On a paid plan you can
   tighten this to run every few minutes for faster retries.

## Intentionally deferred

Cut for scope, not out of laziness — each of these is a reasonable next milestone, not a gap:

- **Multi-user accounts** — no `userId` scoping exists anywhere; see "single password gate" above.
- **Server-side URL fetching for job postings** — paste the JD text instead of a URL. Building a
  robust scraper/readability pipeline is a different skill from the one this project demonstrates,
  and it's a distraction from the LLM-engineering story.
- **Resume PDF upload/parsing** — resume is plain text in Settings. Parsing PDFs reliably is its
  own project.
- **Incoming webhooks / Zapier-style triggers** — only outgoing webhooks exist.
- **A real job/queue system** (BullMQ, SQS, etc.) for webhook retries — justified by scale; the
  in-DB `nextRetryAt` + cron sweep is the right amount of infrastructure for this volume.

## What I'd build next

- Gmail/Outlook integration to auto-detect interview invites and rejections and suggest a status
  change (the natural next "integration" feature after outgoing webhooks).
- A second structured-output pass that drafts a full cover letter, not just an outreach note.
- Incoming webhooks so an external tool (e.g. a browser extension capturing job postings) could
  create applications here directly.
