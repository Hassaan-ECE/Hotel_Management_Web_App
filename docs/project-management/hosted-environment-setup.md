# Hosted Environment Setup

Last updated: 2026-06-02

Use this as the operating playbook for local, staging, and production setup. It covers Clerk, Neon, environment modes, seeding, and Vercel deployment expectations without relying on chat history.

## Required Environment Variables

Set these values in `.env.local` (local) or Vercel Environment Variables (hosted environments) for each scope:

- `DATABASE_URL`: Neon Postgres connection URL.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk frontend publishable key.
- `CLERK_SECRET_KEY`: Clerk server-side secret key.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: Clerk public sign-in redirect target used by hosted routes.
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`: Post sign-in destination path.
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`: Post sign-up destination path.
- `HOTEL_APP_DEMO_MODE`: Environment switch for fallback behavior.
- `HOTEL_APP_ROLE_PREVIEW_ENABLED`: Optional Admin-only hosted QA role preview switch; default `"false"`.
- `HOTEL_APP_ROLE_PREVIEW_USER_IDS`: Optional comma or whitespace separated Clerk user id allow-list for role preview.
- `SEED_CLERK_USER_ID`: Required for `bun run db:seed`.
- `SEED_CLERK_ORGANIZATION_ID`: Optional organization mapping used by the seed command.

Keep values exact per environment. Use the same variable names in Vercel production, preview, and environment-scoped settings.

## Demo mode rule (current implementation)

Demo mode is currently active when **all** of the following are true:

- `HOTEL_APP_DEMO_MODE` is not exactly `"false"`.
- Either Clerk is not configured (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_SECRET_KEY` missing).
- OR Neon is not configured (`DATABASE_URL` missing).

In short: if any required Clerk/Neon value is missing and `HOTEL_APP_DEMO_MODE` is not `false`, the app falls back to demo auth + in-memory demo data.

## 1) Local demo mode

Use this for quick local work and UI behavior checks without external services.

- `.env.local` from `.env.example` is enough.
- Keep default demo settings:
  - `HOTEL_APP_DEMO_MODE="true"` (or omit).
- Missing Clerk or Neon values are acceptable; fallback to demo mode is expected.
- Use the hosted demo fake login flow from `README.md`.

## 2) Local real-service mode

Use this when you want the full Clerk + Neon flow locally:

- Provide `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`.
- Set `HOTEL_APP_DEMO_MODE="false"` explicitly.
- If either service config is missing while demo mode is disabled, the app will not fall back to demo; fix the missing env before testing hosted workflows.
- Run DB setup and seeding:

```powershell
bun run db:migrate
# or bun run db:push during early experimentation
bun run db:seed
```

## 3) Staging

Staging must be real-service mode:

- Set `HOTEL_APP_DEMO_MODE="false"` (required).
- Use dedicated Clerk app/resources and dedicated Neon environment for staging.
- Configure all required Clerk and Neon variables in Vercel for the `preview`/`production` target used by staging.
- Do not reuse local/developer credentials.
- Run migration and seed validation before QA.

## 4) Production

Production must be real-service mode:

- Set `HOTEL_APP_DEMO_MODE="false"` (required).
- Use dedicated Clerk + Neon production resources.
- Seed only in controlled environments with approved owner IDs.
- Run migration/seed validation in a maintenance window and verify ownership/tenant data before enabling user traffic.

For one-account Admin role smoke testing, production may temporarily set:

- `HOTEL_APP_ROLE_PREVIEW_ENABLED="true"`
- `HOTEL_APP_ROLE_PREVIEW_USER_IDS="<approved Clerk Admin user id>"`

Keep this restricted to real Admin users and remove or disable it when one-account role QA is no longer needed.

## Intentional demo-only preview behavior

For PR/branch preview environments, treat missing Clerk/Neon + default demo mode as expected behavior when you do not intentionally want live data:

- Leave `HOTEL_APP_DEMO_MODE` unset or `"true"`.
- Keep sensitive Clerk/Neon env variables absent.
- This guarantees the preview is self-contained demo-only.

If a preview must run against staging services, set all required variables and `HOTEL_APP_DEMO_MODE="false"` intentionally.

## Seed behavior (`bun run db:seed`)

- Requires `SEED_CLERK_USER_ID` to be set or seed fails immediately.
- `SEED_CLERK_ORGANIZATION_ID` is optional.
- Seed creates/updates:
  - One organization row (`id` `org_demo_portfolio`) with optional `clerk_organization_id`.
  - Two realistic demo hotels.
  - Rooms, reservations, guests, booking requests, housekeeping tasks, and maintenance tickets.
  - Staff rows for each hotel (demo users in DB with null Clerk IDs).
  - Owner memberships for the `SEED_CLERK_USER_ID` in each seeded hotel.
- The seed script logs `Seeded realistic hosted hotel demo data for <SEED_CLERK_USER_ID>`.

Staff login provisioning beyond the seeded owner membership is currently a manual pilot process. Use `docs/project-management/production-auth-provisioning.md` for Clerk invites, app database memberships, role changes, and deactivation.
