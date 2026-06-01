# Release Checklist

Last updated: 2026-06-01

For a clean environment or copied worktree, start with the local demo setup from
`README.md`:

```powershell
Copy-Item .env.example .env.local
bun install
```

Then run these checks before considering a branch or deployment candidate ready:

```powershell
bun run test
bun run typecheck
bun run lint
bun run build
bun run db:migrate
bun run db:seed
```

Record the results in `docs/project-management/validation-log.md`.

## Migration and Seed Validation

Before staging/production release candidates, run:

```powershell
bun run db:migrate
bun run db:seed
```

Seed validation expectations:

- `SEED_CLERK_USER_ID` must be set before `bun run db:seed`; script should fail fast when missing.
- Seed command should create realistic hotel data and owner memberships.
- `hotel_memberships` should include active owner memberships for the seeded user in each seeded hotel.
- `organizations` should contain `org_demo_portfolio` row and report `clerk_organization_id` when `SEED_CLERK_ORGANIZATION_ID` is set.
- No `demo` fallbacks should be required in staging or production (`HOTEL_APP_DEMO_MODE="false"` in both envs).

Recommended post-seed checks:

```sql
SELECT COUNT(*) AS hotel_count FROM hotels;
SELECT COUNT(*) AS fixture_hotel_count FROM organizations WHERE id = 'org_demo_portfolio';
SELECT COUNT(*) AS owner_membership_count
FROM hotel_memberships
WHERE clerk_user_id = '<SEED_CLERK_USER_ID>' AND role = 'owner' AND active = true;
```

If a smoke preview environment is intentionally demo-only, confirm `HOTEL_APP_DEMO_MODE` is not `"false"` and service keys are absent or incomplete by design.

## Auth Provisioning Validation

Before a staging or production pilot:

- Confirm Clerk sign-up policy is intentionally restricted for the pilot.
- Confirm every pilot user has a Clerk user id in the correct environment.
- Confirm every pilot user has the intended active `hotel_memberships` rows.
- Confirm non-owner operational users have active `staff` rows where needed.
- Smoke owner portfolio access, one staff role login, wrong-hotel denial, and staff deactivation.

## Build Font Reliability

Production builds should not fetch remote font assets. The app uses deterministic system-local font stacks instead of remote font loading.

If a future build fails because it is trying to fetch fonts from the network, treat that as a release-gate regression and either remove the remote dependency or explicitly document and approve the requirement.

## Manual Smoke Checks

Before a hosted pilot, also smoke these role flows in demo mode or staging:

- Owner portfolio opens both demo hotels.
- Front desk search, walk-in, check-in, and check-out work.
- Housekeeping assignment, start, finish, approval, and send-back work.
- Maintenance ticket create, update, resolve, and cancel work.
- CSV export and JSON backup routes return data for the active hotel only.
- Vercel Preview on iPhone 15 Pro Max: sign-in redirects, no public sign-up surface, owner portfolio, staff hotel redirect, no-membership panel, and core pages fit without broken mobile layout.
