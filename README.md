# KaveLog

Self-managed attendance tracking for Kavelogics employees. Not affiliated with the company — it's a tool we use among ourselves to compare against HR records.

See [`SPEC.md`](./SPEC.md) for the full product specification and [`policies.md`](./policies.md) for the rules that drive the math.

## Stack

- Next.js 16 (App Router) + Tailwind CSS
- Drizzle ORM + PostgreSQL (Supabase)
- NextAuth v5 (email + password)
- Hosted on Vercel

## Getting started

### 1. Clone and install

```bash
npm install
```

### 2. Create a Supabase project

- Create a free project at [supabase.com](https://supabase.com).
- In **Project Settings → Database**, copy the **Connection string** (use the **Session pooler / Transaction pooler** URI for serverless).
- Paste it into `.env` as `DATABASE_URL`.

### 3. Set environment variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 4. Push the database schema

```bash
npm run db:push
```

This creates all tables. For migrations later, use `npm run db:generate` then `npm run db:migrate`.

### 5. Create the first admin

```bash
npx tsx scripts/create-admin.ts you@example.com "Your Name" "your-strong-password"
```

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the admin you just created.

## Day-to-day

- Sign in as admin, go to **Admin → Departments** and add your departments (Development, Design, HR, BD).
- Optionally add **Holidays**.
- Toggle **Settings → Open registration** if you don't want to manually approve every signup.
- Share the URL with your team — they self-register, you approve them.
- Everyone uses the **Today** page to clock in/out. Calendar and Reports show the rest.

## Deployment

The project is built for Vercel:

1. Push to GitHub.
2. Import the repo into Vercel.
3. Add environment variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`).
4. Deploy.

The `vercel.json` schedules `/api/cron/auto-absent` daily at 00:05 UTC to mark missed weekday clock-ins as absent. Set `CRON_SECRET` to protect the endpoint.

## Project structure

```
src/
  app/
    (auth)/         # /login, /register, /forgot, /reset
    (app)/          # authenticated app: dashboard, calendar, reports, support, admin
    api/            # API routes
    pending/        # holding page for users awaiting approval
  components/       # ClockButton, AppShell, NotificationBell, TicketThread, UI primitives
  db/               # Drizzle schema and client
  lib/              # policy.ts (overtime/hours math), attendance.ts (queries), utils.ts
  auth.ts           # NextAuth config
  middleware.ts     # session + role gates
scripts/
  create-admin.ts   # bootstrap the first admin
drizzle/            # generated migrations
```
