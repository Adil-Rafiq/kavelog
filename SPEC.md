# KaveLog — Product Specification

## Overview
KaveLog is a self-managed employee attendance tracking web app for Kavelogics employees. It is not affiliated with the company officially. Its purpose is informational and reference-based — employees track their own attendance so they can compare against HR records if discrepancies arise. No enforcement, trust is assumed.

---

## Users & Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Manage departments, manage holidays, approve/reject registrations, edit any employee's records, view all reports, manage support tickets, toggle registration mode |
| **Employee** | Self-register, clock in/out, manually add/edit own records, view own reports, submit support tickets |

**Team size:** Under 30 users.

---

## Authentication

- Email + password (hashed with bcrypt, sessions via NextAuth.js + JWT)
- Self-registration by employees
- **Default**: new accounts require Admin approval before first login ("pending" state)
- **Toggle**: Admin can switch to open registration (immediate activation) at any time and back
- Admin receives in-app notification when a new registration is pending

---

## Departments

- Admin creates, edits, and deletes departments
- Employees choose their department during self-registration (no verification)
- If a department is missing, employee submits a support ticket to admin
- Department determines the employee's shift and break schedule

### Shifts (from policy)

| Teams | Shift | Break |
|-------|-------|-------|
| Development, Design, HR | 10:00 AM – 7:00 PM | 1:00 PM – 2:00 PM |
| BD | 6:00 PM – 3:00 AM | 10:00 PM – 11:00 PM |

- 8 working hours + 1 break hour per day

---

## Attendance Records

### Status Types
- `Present` — employee clocked in and out
- `Absent` — no activity recorded on a working day
- `Paid Leave` — employee-marked leave day

### Per-Day Record Fields
- Date
- Status (`Present` | `Absent` | `Paid Leave`)
- Clock-in time (only if Present)
- Clock-out time (only if Present)
- Notes (optional free text)

### Clock-In / Clock-Out Rules
- One clock-in and one clock-out per day (no multiple sessions)
- Manual entry and editing allowed for both employee and admin (retroactive corrections)
- When a day is marked `Paid Leave` or `Absent`, clock-in/out times are cleared

### Auto-Log Logic
- `Absent` is a **manual status only** — the app never auto-marks anyone absent. A weekday a user forgets to log simply stays blank.
- **Opt-in auto-log**: each user can enable "Auto-log my shift" on their account page. When on, a nightly job fills any fully-missed weekday (no record yet, not a holiday) with a `Present` record using their shift's default clock-in/out (e.g. 10:00 AM – 7:00 PM). It never touches days already logged, weekends, holidays, or users who haven't opted in.
- **Auto-logged flag**: auto-filled records carry an `autoLogged` flag so the employee can tell them apart from ones they entered themselves — surfaced as an "Auto" marker on the calendar day and an "Auto-logged" notice in the day editor. The flag clears automatically the moment the day is manually edited (via the day editor or a clock in/out), so it only ever marks an untouched auto-fill.
- **Weekends (Sat–Sun)**: left blank by default; employees can voluntarily clock in if they worked (counts toward monthly totals).

---

## Paid Leave Policy

- 14 paid leaves per year per employee
- Max 1 paid leave per month (2 in emergencies)
- Employee marks their own paid leave — no approval required
- App displays counters: used this month, used this year, remaining — informational only, no hard blocks
- Soft warning shown if monthly limit is exceeded

---

## Overtime Calculation

Calculated automatically based on clock-out time vs. shift end time.

**Logic:**
1. A 30-minute checkout window opens after shift end (e.g., 7:00 PM – 7:30 PM for first shift)
2. Time within this window does NOT count as overtime
3. After the window, overtime is counted in **30-minute chunks**
   - 7:30 PM – 8:00 PM = 1 chunk
   - 8:00 PM – 8:30 PM = 2 chunks
   - etc.

**Displayed:**
- Overtime chunks per day
- Running monthly total chunks
- Running yearly total chunks
- No pay amount calculated (pay per chunk varies per employee and is not tracked in the app)

---

## Holidays

- Admin manages a holiday list (add/remove holiday dates)
- Holidays are applied using **Option B**: the monthly expected working hours target is reduced by 8 hours per holiday (not auto-credited to employees)
- Weekday holidays are excluded from auto-log (no shift is auto-filled on a holiday)
- Employees who choose to work on a holiday have their actual hours counted normally

---

## Reports & Exports

### Employee View
- Monthly attendance calendar (color-coded: Present / Absent / Paid Leave / Weekend / Holiday)
- Monthly summary stats:
  - Days present, absent, paid leave used
  - Paid leaves remaining (monthly + yearly)
  - Total hours worked
  - Overtime chunks
  - Expected hours for the month (adjusted for holidays)
- Year-to-date totals

### Admin View
- Table of all employees' monthly summaries
- Filterable by department and month
- YTD view per employee

### Export
- CSV export (monthly and YTD, for both employee and admin views)

---

## Notifications (In-App Only)

No email notifications. All notifications appear as in-app bell/badge alerts.

| Event | Recipient |
|-------|-----------|
| New registration pending approval | Admin |
| Account approved | Employee |
| Account rejected | Employee |
| Attendance record edited by admin | Employee |
| Support ticket reply | Employee / Admin |

---

## Support System

- In-app ticket/message system
- Employee submits a support request with a message (e.g., "Please add department X")
- Admin sees all open tickets in their panel and can respond or resolve them

---

## Data Retention

- All records stored indefinitely
- No archival or deletion policy

---

## Design & UX

- **Style**: Modern/minimal with dark mode support
- **Layout**: Mobile-first responsive web app (primary use case is clocking in from phone)
- Clock In/Out button is the hero element on mobile
- Admin/report views optimized for desktop
- Design implemented using the `/frontend-design:frontend-design` skill

### First-login walkthrough
- On a user's first login, a spotlight tour auto-starts and highlights one real control at a time, navigating across the actual pages: clock-in (Today) → monthly stats (Today) → calendar (fix a missed day) → reports/CSV export → the **Auto-log my shift** setting on Account.
- Seen-state is **per-account** (`users.onboarded_at`): it shows exactly once and never auto-starts again on any device. Finishing or skipping both stamp it.
- Users can replay it any time from **Account → Product tour → Take the tour**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle |
| Auth | NextAuth.js (email + password) |
| Hosting | Vercel (`kavelog.vercel.app`) |

---

## Database Schema (Draft)

### users
- id, name, email, password_hash, role (admin/employee), department_id, status (pending/active/rejected), auto_log_shift, onboarded_at, created_at

### departments
- id, name, shift (first/second), created_at

### attendance_records
- id, user_id, date, status (present/absent/paid_leave), clock_in, clock_out, overtime_chunks, notes, created_at, updated_at

### holidays
- id, date, name, created_at

### notifications
- id, user_id, message, type, read (bool), created_at

### support_tickets
- id, user_id, message, status (open/closed), created_at

### support_messages
- id, ticket_id, user_id, message, created_at

### settings
- id, key, value (for global toggles like open_registration)

---

## Policy Reference

Sourced from `policies.md`:

1. Max 14 paid leaves per year; max 1 per month (2 in emergencies)
2. Dev/Design/HR shift: 10AM–7PM | BD shift: 6PM–3AM
3. 8 working hours + 1 break hour (break: 1–2PM or 10–11PM depending on shift)
4. Overtime: 30-min checkout window → then 30-min chunks count
