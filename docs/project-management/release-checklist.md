# Release Checklist

Last updated: 2026-06-02

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
- Confirm the deployed build includes Clerk middleware and does not flash between `/sign-in` and `/portfolio` after sign-in.
- If Admin role preview is enabled, confirm `HOTEL_APP_ROLE_PREVIEW_USER_IDS` contains only approved Clerk Admin user ids and disable it after one-account role QA when no longer needed.

## Build Font Reliability

Production builds should not fetch remote font assets. The app uses deterministic system-local font stacks instead of remote font loading.

If a future build fails because it is trying to fetch fonts from the network, treat that as a release-gate regression and either remove the remote dependency or explicitly document and approve the requirement.

## Manual Smoke Checks

Before a hosted pilot, also smoke these role flows in demo mode or staging:

- Owner portfolio opens both demo hotels.
- Front desk hub opens at `/hotels/<hotelId>/front-desk`, instant search updates while typing, and results are hotel-scoped.
- Front desk walk-in opens at `/hotels/<hotelId>/front-desk/walk-in`, creates a checked-in reservation, and redirects to reservations.
- Front desk reservations opens at `/hotels/<hotelId>/front-desk/reservations`; booking board is the default, the table toggle remains available, table search/filter/sort work, and check-in/check-out actions use the guarded status route.
- Front desk booking board defaults to a 7-day exclusive range starting today; date range changes update the URL, empty room rows are hidden by default, longer ranges use one shared compressed timeline without horizontal dragging, reservation bars align to room/date spans, bars show guest names only, and clipped bars have squared/thicker clipped-side edges.
- Front desk reservation table entries and booking-board bars open `/hotels/<hotelId>/front-desk/reservations/<reservationId>`.
- Front desk check-out action opens a confirmation dialog before moving the room to dirty and creating housekeeping turnover work.
- Front desk hub room readiness appears under the main workflow and summarizes ready-to-sell rooms, housekeeping needs, blocked rooms, departures, and room-type availability.
- Front desk walk-in page does not show the extra `Available rooms` side panel; guest, stay, and rate/notes fields are grouped clearly and check-in/check-out fields do not overlap or overflow on iPhone widths.
- Housekeeping assignment, start, finish, approval, and send-back work.
- Maintenance ticket create, update, resolve, and cancel work.
- CSV export and JSON backup routes return data for the active hotel only.
- Vercel Preview on iPhone 15 Pro Max: sign-in redirects, no public sign-up surface, owner portfolio, staff hotel redirect, no-membership panel, and core pages fit without broken mobile layout.
- Production iPhone 15 Pro Max auth check: sign-in page has no horizontal overflow, Clerk card stays inside the viewport, and post-sign-in navigation settles on the expected page.
- Production hotel workspace check: opening each hotel from portfolio does not show React object/date rendering errors, and the mobile topbar remains one compact row after sign-in.
- Production mobile dashboard check: metric cards scan as compact two-column tiles, and export/download actions appear in `Data exports` instead of the page title.
- Production export check: downloaded filenames include the hotel name, such as `pecos-motor-inn-reservations.csv`, so files from different hotels do not collide.
- Production Admin role preview check, only when enabled: open a hotel, open the account/profile modal from the user button, use `Role preview` to switch from Admin to Front desk, Housekeeping supervisor, Housekeeper with a selected staff member, and Maintenance; confirm manager-only exports are denied while previewing a staff role, then exit preview back to Admin.
