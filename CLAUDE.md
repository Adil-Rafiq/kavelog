# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KaveLog is a self-managed attendance tracker for Kavelogics employees (a small team, <30 users). It is not an official company tool — employees log their own attendance to compare against HR records. Trust is assumed; there is no enforcement and no hard blocks. `SPEC.md` is the product spec and `policies.md` is the source of truth for the attendance math; when behavior and spec disagree, reconcile against those two files.

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build — also the only full typecheck (tsconfig has noEmit)
npm run lint         # ESLint (next lint)

npm run db:push      # Push schema.ts straight to the DB (use in dev)
npm run db:generate  # Generate a SQL migration from schema.ts changes
npm run db:migrate   # Apply generated migrations (use for prod schema changes)
npm run db:studio    # Drizzle Studio

npx tsx scripts/create-admin.ts <email> <name> <password>   # Bootstrap/upgrade an admin
```

There is no test framework configured — `npm run build` (typecheck) and `npm run lint` are the available checks. Scripts run through `tsx` and load env via `dotenv/config`, so they read `.env` directly.

## Architecture

Next.js 15 App Router + Tailwind, Drizzle ORM over PostgreSQL (Supabase), NextAuth v5 (credentials), deployed on Vercel. Path alias `@/*` → `src/*`.

### Auth is split into two files on purpose
- `src/auth.config.ts` — **edge-safe** config with no DB import. Consumed by `middleware.ts`, which runs on the Edge runtime and cannot use the Node `postgres` driver.
- `src/auth.ts` — full config: the `Credentials` provider (bcrypt + DB lookup) and the `jwt`/`session` callbacks. Used by API routes and server components.

Session is JWT-based. The token carries `id`, `role`, `status`, `departmentId`; changing any of these server-side won't reach the client until the token refreshes — the client triggers a refresh via `update({ refresh: true })`, handled in the `jwt` callback in `auth.ts`.

### Access control lives in `middleware.ts`
It gates everything except `PUBLIC_PATHS`: unauthenticated → `/login`; authenticated but `status !== "active"` → `/pending`; `/admin/*` requires `role === "admin"`. The `matcher` deliberately excludes PWA assets (manifest, icons, `sw.js`, `offline.html`) so the browser can fetch them pre-auth. Server components and API routes still re-check `auth()` themselves — middleware is not the only guard.

### Page/component convention
Route `page.tsx` files are **server components** that call `auth()` and fetch data with Drizzle, then hand off to a co-located **client component** for interactivity: `*-client.tsx`, `*-view.tsx`, `*-admin.tsx`, or `today-panel.tsx`. Mutations go through `src/app/api/**/route.ts` handlers (Zod-validated), not server actions. Follow this split when adding features.

### The DB client is cached on `globalThis`
`src/db/client.ts` stashes the `postgres` pool on `globalThis` in non-production so HMR reuse doesn't exhaust connections. Always import `db` from here; never construct a new `postgres()` client.

## Attendance domain logic (the important part)

All the real complexity is in two files. Read them before touching anything attendance-related.

### `src/lib/policy.ts` — pure math, no DB
- **Shifts**: `first` = 10:00–19:00 (break 13:00–14:00); `second` = 18:00–03:00 next day (break 22:00–23:00, `crossesMidnight: true`). Department → shift; a user with no department defaults to `first`.
- **Worked hours** (`computeWorkedHours`): clock-out minus clock-in, minus a fixed 1h break *only if* the window is ≥5h.
- **Overtime** (`computeOvertimeChunks`): OT eligibility starts at the **later** of (a) `clockIn + 9h` rounded up to the next :00/:30, and (b) `shiftEnd + 30min` checkout window. Each full 30-min block after that is one chunk. This is subtle and was reworked once (see `TODO.md`) — preserve the "later of two" rule and the round-up.
- **Timezone**: wall-clock shift times are in `APP_TIME_ZONE` (default `Asia/Karachi`, no DST). `zonedWallTimeToUtc` converts a wall time to a UTC instant so server-generated auto-log instants render as the same clock time as browser-entered ones. Don't replace this with naive `new Date(...)`.
- **Holidays / paid leave** (`expectedMonthlyHours`, "Option B"): each weekday holiday *and* each weekday paid-leave day reduces the monthly target by 8h rather than crediting hours. The two counts must not overlap for the same date (guarded in `attendance.ts` via `holidayKeys`).

### `src/lib/attendance.ts` — DB-backed summaries
`summarizeMonth` computes both full-month figures and separate **"to date"** figures (`hoursWorkedToDate`, `expectedHoursToDate`) that power the month-pace indicator. The to-date logic only counts working days that have *elapsed*: a day still in progress is excluded from both sides, and **today counts only once its record is complete** (clocked out, or marked absent/paid-leave) — an open clock-in stays out. If you change what "complete" means, update `todayDone`/`countsToDate` together.

### Auto-log (opt-in) and the `autoLogged` flag
- `Absent` is **manual only** — nothing ever auto-marks absent.
- The nightly cron `GET /api/cron/auto-log` (Vercel, 00:05 UTC via `vercel.json`) fills *yesterday* for users who set `users.autoLogShift = true`, but only if the day is a weekday, not a holiday, and has no existing record. It writes a `present` record from shift defaults with `autoLogged: true`. Protected by `CRON_SECRET` (Bearer header).
- The `autoLogged` flag is cleared to `false` the moment the day is manually touched — both `api/attendance/clock` and `api/attendance/record` reset it on write. It exists purely so the UI can mark untouched auto-fills. Keep both write paths clearing it.

## Data model notes (`src/db/schema.ts`)
- One attendance row per `(userId, date)` — enforced by `attendance_user_date_idx`. All mutation paths upsert against this pair.
- `settings` is a key-value table; keys are in `SETTING_KEYS` (currently just `open_registration`). Read/write via `src/lib/settings.ts`.
- Notifications are in-app only (no email except password reset via Resend). Create them with `notify()` from `src/lib/notifications.ts`. Admin edits to a user's record generate a `record_edited` notification.
- `onboardedAt` (null = tour not yet seen) drives the first-login spotlight tour, wired in `src/app/(app)/layout.tsx` → `TourProvider`.

## Environment
Required: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`. Also used: `CRON_SECRET` (cron auth), `RESEND_API_KEY` + `EMAIL_FROM` (password-reset email), `NEXT_PUBLIC_APP_URL` (reset links), `APP_TIME_ZONE` (optional shift-zone override). See `.env.example`.
