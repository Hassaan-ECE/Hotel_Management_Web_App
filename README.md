# Hosted Hotel Management Web App

A hosted Next.js version of the desktop hotel management MVP. This project is separate from `D:\Projects\Active\Hotel_Management_App`; the desktop app is left untouched and used as a product/reference source only.

## Stack

- Next.js App Router on Vercel
- Clerk invite-only authentication
- Neon Postgres with Drizzle schema/migrations
- React 19, TypeScript, Tailwind CSS
- Bun package manager

## Local Setup

```powershell
Copy-Item .env.example .env.local
bun install
bun run dev
```

For production-grade hosted environment setup, including demo/staging/production mode behavior and Vercel variables, see [`docs/project-management/hosted-environment-setup.md`](docs/project-management/hosted-environment-setup.md).

You can run the app without Clerk or Neon during development. If either Clerk or Neon is not configured and `HOTEL_APP_DEMO_MODE` is not set to `false`, the app uses the local fake login page and in-memory sample hotel data.

Demo login accepts the same desktop prototype codes plus an owner code for the hosted portfolio:

| Code | Fake user id | Role |
| --- | --- | --- |
| `0` | `demo-owner` | Owner across both demo hotels |
| `1` | `staff-manager` | Manager |
| `2` | `staff-front-desk` | Front desk |
| `3` | `staff-housekeeping-supervisor` | Housekeeping supervisor |
| `31` | `staff-hk-ava` | Housekeeper |
| `32` | `staff-hk-ben` | Housekeeper |
| `33` | `staff-hk-mia` | Housekeeper |
| `34` | `staff-hk-noah` | Housekeeper |
| `4` | `staff-maintenance` | Maintenance |

The demo mode supports the desktop app workflows: portfolio dashboard, hotel workspace, front desk search, guest records, walk-in reservation, check-in/out, room status updates, housekeeping task creation and assignment, housekeeper start/finish flow, supervisor approval/send-back, room issue reports and review, maintenance tickets, CSV exports, backup JSON export, and server-side hotel/role checks. Demo data resets whenever the dev server restarts.

Only owner code `0` sees the multi-hotel portfolio. Employee demo logins go directly to their assigned hotel workspace.

When you are ready to connect real hosted services, set Clerk and Neon values in `.env.local` and set `HOTEL_APP_DEMO_MODE="false"`.

## Database

```powershell
bun run db:generate
bun run db:push
bun run db:seed
```

The seed script creates a demo organization, two hotels, rooms, guests, reservations, staff, housekeeping tasks, maintenance tickets, and memberships for `SEED_CLERK_USER_ID`.

## Scope

- Owners can see a portfolio dashboard across all hotels they belong to.
- Each hotel has isolated rooms, reservations, staff, housekeeping, maintenance, reports, and audit logs.
- API handlers verify Clerk auth and hotel membership on every request.
- Staff access is invite-only through Clerk and app-level hotel memberships.
