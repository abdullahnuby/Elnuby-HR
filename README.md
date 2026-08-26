# ELNUBY HR

Site HR / Workforce Management System for construction projects.

## Stack

- Next.js 15
- React 19
- TypeScript
- Supabase / PostgreSQL
- Vercel

## Project structure

### Frontend

`src/app/page.tsx` is now a thin application shell. UI modules live under `src/components/hr/`:

- dashboard
- employees
- projects
- shifts
- attendance
- leaves
- permissions
- users
- reports
- settings
- shared UI/types/constants

### Backend

`src/app/api/hr/route.ts` is a thin HTTP entrypoint. Server logic is split under `src/server/hr/`:

- `core.ts` — Supabase client, auth/session helpers, shared scope rules
- `auth.ts` — login / me
- `dashboard.ts` — dashboard services
- `workforce.ts` — employees, projects, shifts, assignments
- `attendance.ts` — attendance/GPS
- `leaves.ts` — leave workflow
- `permissions.ts` — permission workflow
- `users.ts` — users and deductions
- `router.ts` — action dispatcher

## Roles

- `SUPER_ADMIN`
- `HR_MANAGER`
- `PROJECT_MANAGER`
- `SECTOR_MANAGER`
- `PROJECT_MANAGER`
- `EMPLOYEE`

`PROJECT_MANAGER` is scoped by `project_managers`.
`SECTOR_MANAGER` (مدير قطاع / مدير مشروعات) is an employee-linked role scoped by `sector_manager_projects` and can manage the project managers and workforce within those assigned projects.
`PROJECT_MANAGER` is scoped by `project_supervisors` and remains an employee-linked role capable of attendance.

## Environment

Copy `.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_NAME=ELNUBY HR
```

The service-role key is server-only and must never be exposed to client code.

## Run locally

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Checks

```bash
npm run test:contract
npm run test:backend
```

These checks validate that frontend API actions map to the modular backend and that the expected backend/security modules are present.

## Database

The production data source is Supabase/PostgreSQL. Google Apps Script and Google Sheets are not part of the current runtime architecture.

Database hardening and scope migrations are maintained in Supabase migrations and should be kept synchronized with the repository before production releases.

## 2026 architecture hardening

- Business data uses the canonical Supabase `hr` schema.
- Server sessions remain in `public.app_sessions` and are delivered to the browser only as an HttpOnly `elnuby_hr_session` cookie.
- Passwords created after this release use Node `scrypt`; legacy SHA-256 records are transparently upgraded after successful login.
- `PROJECT_MANAGER` access is scoped through `hr.project_supervisors` and project scope checks.
- Attendance auto-checkout is evaluated on every attendance-list refresh and also reconciled by the Vercel Hobby-compatible daily cron at `/api/cron/auto-checkout`.
- SQL migrations are stored under `supabase/migrations/`.
- Browser authentication tokens are not stored in localStorage.

### Production environment

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended:

- `CRON_SECRET`
