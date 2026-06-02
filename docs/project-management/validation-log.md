# Validation Log

Last updated: 2026-06-01

## 2026-06-01 Baseline

Context:

- Initial project-management onboarding and repo audit.
- Pre-existing uncommitted changes were present in demo/seed/fixture-related files before PM docs were added.

Checks run:

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: failed in sandboxed mode because Next.js could not fetch `Geist Mono` from Google Fonts.

```powershell
bun run build
```

Result: passed after network access was allowed for the build.

Notes:

- No test files or test config were found during the initial scan.
- Build validation currently depends on network access for Google font fetching.
- Production route output showed dynamic app routes for portfolio, hotel workspaces, API handlers, and sign-in.

## 2026-06-01 Tenant Isolation Hotfix

Context:

- Implemented Packet 1 from `active-sprint.md`.
- `saveGuest` and `createWalkInReservation` now require supplied guest IDs to belong to the active hotel.
- Added focused Bun regression tests for production service behavior and demo-store parity.

Checks run:

```powershell
bun run test
```

Result: passed. 10 tests passed across `test/guest-tenant-isolation.test.ts`.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: failed in sandboxed mode because Next.js could not fetch `Geist Mono` from Google Fonts.

```powershell
bun run build
```

Result: passed after network access was allowed for the build.

Notes:

- Cross-hotel and missing guest IDs are rejected in both `saveGuest` and `createWalkInReservation`.
- Same-hotel guest IDs can still be updated and reused for walk-ins without duplicating guests.
- Build reliability still depends on network access for Google font fetching.

## 2026-06-01 Packet 2 Route Hardening

Context:

- Implemented Packet 2 route hardening for search-limit normalization and housekeeping status validation.
- Added shared `normalizeSearchLimit` and `housekeepingStatusSchema` in `src/lib/validation.ts`.
- Wired normalized search limits into `src/app/api/hotels/[hotelId]/search/route.ts` and `searchFrontDesk` in `src/lib/hotel-service.ts`.
- Added focused tests for limit normalization, SQL limit propagation, and housekeeping status validation.

Checks run:

```powershell
bun run test
```

Result: passed. 32 tests passed across `test/guest-tenant-isolation.test.ts` and `test/validation-packet-2.test.ts`.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: failed in sandboxed mode because Next.js could not fetch `Geist Mono` from Google Fonts.

```powershell
bun run build
```

Result: passed after network access was allowed for the build.

Notes:

- Invalid limits and invalid housekeeping statuses are now covered by focused tests.
- Route shapes remain unchanged:
  - GET `/api/hotels/[hotelId]/search?q=&limit=`
  - POST `/api/hotels/[hotelId]/housekeeping/tasks`

## 2026-06-01 Packet 3 Test Foundation

Context:

- Made `bun run test` the official project test command in PM documentation.
- Added service workflow tests for reservation status, housekeeping, and maintenance transitions.
- Added API route authorization tests for representative role denial, wrong-hotel denial, and successful service handoff.
- Added `testing.md` and `release-checklist.md`.

Checks run:

```powershell
bun test test\hotel-service-workflows.test.ts
```

Result: passed. 14 tests passed across `test/hotel-service-workflows.test.ts`.

```powershell
bun test test\route-authz.test.ts
```

Result: passed. 7 tests passed across `test/route-authz.test.ts`.

```powershell
bun run test
```

Result: passed. 53 tests passed across 4 files.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: failed in sandboxed mode because Next.js could not fetch `Geist Mono` from Google Fonts.

```powershell
bun run build
```

Result: passed after network access was allowed for the build.

Notes:

- `bun run test` is now part of the documented release gate.
- Route denial tests cover representative role and tenant failures before service calls.
- Service workflow tests cover reservation status, housekeeping, and maintenance transitions with same-hotel SQL mocks.

## 2026-06-01 Packet 4 Hosted Environment Setup

Context:

- Added hosted environment setup and documentation updates for Clerk, Neon, demo mode behavior, seed data, and Vercel environment expectations.
- Updated PM docs, checklists, ownership scopes, and root pointer for discoverability.
- No application, schema, fixture, route, test, or source behavior files were modified.

Checks run:

```powershell
git diff --check
```

Result: passed during worker implementation and manager review (no whitespace/merge conflict markers).

```powershell
rg -n "[ \t]+$" README.md .env.example docs/project-management
```

Result: passed by returning no matches for trailing whitespace in the docs/config files touched by this packet.

```powershell
git status --short --ignored .env.example .gitignore README.md docs/project-management
```

Result: passed for the `.env.example` tracking check. After the manager follow-up, `.env.example` appeared as untracked (`??`) instead of ignored (`!!`).

Checks skipped:

- `bun run test` — skipped because this packet is docs/config documentation only.
- `bun run typecheck` — skipped because no type-checked source changed.
- `bun run lint` — skipped because no source behavior changed.
- `bun run build` — skipped because no runtime source or build inputs changed.
- `bun run db:migrate` — skipped because this packet documents behavior and commands only.
- `bun run db:seed` — skipped because this packet documents seed behavior only.

Notes:

- Packet 4 is complete after documentation edits only.
- `HOTEL_APP_DEMO_MODE` is now explicitly documented as required to be `"false"` for staging and production.
- Manager follow-up added a `.gitignore` exception so `.env.example` can be committed normally while real `.env*` files remain ignored.

## 2026-06-01 Packet 5 Remaining P0 Hardening

Context:

- Added strict workflow transition guards for reservation status, housekeeping actions, and maintenance ticket status movement.
- Applied parity in `demo-store` because service functions short-circuit to demo mode.
- Added regression tests for invalid transitions, valid same-hotel transitions, idempotent reservation same-status updates, cross-hotel housekeeping paths, and demo parity.
- GPT-5.3-Codex-Spark was attempted twice for implementation, but the selected model was at capacity before making changes; manager implemented the scoped packet and performed review.

Checks run:

```powershell
bun test test\hotel-service-workflows.test.ts
```

Result: passed. 22 tests passed across `test/hotel-service-workflows.test.ts`.

```powershell
bun test test\demo-workflow-guards.test.ts
```

Result: failed once because the first demo reservation test depended on a fixture search result that was not guaranteed. The test was made self-contained by creating and checking out a walk-in reservation, then rerun successfully.

```powershell
bun test test\demo-workflow-guards.test.ts
```

Result: passed. 4 tests passed across `test/demo-workflow-guards.test.ts`.

```powershell
bun run test
```

Result: passed. 65 tests passed across 5 files with 195 assertions.

```powershell
bun run typecheck
```

Result: failed once because `src/lib/validation.ts` had duplicate exported transition helper definitions. The duplicate block was removed.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
git diff --check
```

Result: passed (no whitespace/merge conflict markers).

Notes:

- Invalid workflow jumps now reject with clear `badRequest` errors.
- Same-hotel valid reservation, housekeeping, and maintenance transitions still pass.
- Cross-hotel housekeeping assignment, action, and issue-report paths are explicitly covered.
- Demo send-back now matches production by returning task and room state to `dirty`.

## 2026-06-01 Packet 6 Clean Copy Release Gate Verification

Context:

- Verified setup from a clean copied worktree at `C:\Users\syedh\AppData\Local\Temp\hotel-web-packet6-clean-20260531215202`.
- The clean copy included the current Packet 1-5 working tree and excluded `.git`, `node_modules`, `.next`, `.vercel`, generated build/typecheck state, and real `.env*` files other than `.env.example`.
- Followed the local setup path from `README.md` by copying `.env.example` to `.env.local`, then installing dependencies.

Checks run:

```powershell
Copy-Item .env.example .env.local
```

Result: passed. `.env.local` was created from `.env.example` in the clean copy.

```powershell
bun install
```

Result: passed. 384 packages installed with Bun 1.3.13.

```powershell
bun run test
```

Result: passed. 65 tests passed across 5 files with 195 assertions.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: passed in the clean copy. The run used `.env.local`, compiled successfully, completed TypeScript, generated 5 static pages, and did not surface the prior `Geist Mono` font-fetch failure.

```powershell
git check-ignore -v .env.example
```

Result: passed for tracking intent. Output showed `.gitignore` explicitly unignores `.env.example` with `!.env.example`.

```powershell
git ls-files --others --exclude-standard .env.example
```

Result: passed. Output included `.env.example`, confirming it is commit-eligible and not excluded.

```powershell
git diff --check
```

Result: passed. Git printed CRLF normalization warnings for existing modified files, but no whitespace errors or conflict markers.

```powershell
rg -n "[ \t]+$" docs/project-management
```

Result: passed by returning no matches for trailing whitespace in PM docs, including currently untracked docs.

```powershell
git status --short --ignored .env.example .gitignore README.md docs/project-management
```

Result: passed for scope awareness. `.env.example` and `docs/project-management/` remain untracked in this working tree, while `.gitignore` and `README.md` are modified from earlier packets.

Docs updated:

- `docs/project-management/release-checklist.md` now includes the clean-environment setup sequence before the release gate commands.
- `docs/project-management/active-sprint.md` and `docs/project-management/backlog.md` mark Packet 6 / clean clone setup verification complete.

Notes:

- `.env.example` was sufficient for local demo-mode setup when copied to `.env.local`.
- Build was run from the clean copied worktree with approved access because the copy lived outside the writable sandbox. No Google font network failure occurred during this Packet 6 build; the known sandbox/offline caveat remains documented.

## 2026-06-01 Packet 7 Real Hosted Migration And Seed Validation

Context:

- Attempted to start Packet 7 staging validation.
- Acceptance criteria require dedicated staging Clerk + Neon values and `HOTEL_APP_DEMO_MODE="false"`.
- No real staging env values were available in `.env.local` or the current process environment.

Checks run:

```powershell
# Secret-safe env availability check for DATABASE_URL, Clerk keys, redirect URLs,
# HOTEL_APP_DEMO_MODE, SEED_CLERK_USER_ID, and SEED_CLERK_ORGANIZATION_ID.
```

Result: blocked. `.env.local` was absent, and all required staging values were missing from the current process environment. `HOTEL_APP_DEMO_MODE` was not set to `"false"` because it was missing.

Checks skipped:

- `bun run db:migrate` - skipped to avoid migrating an unknown, placeholder, demo, or production target.
- `bun run db:seed` - skipped because `DATABASE_URL`, Clerk config, `HOTEL_APP_DEMO_MODE="false"`, and `SEED_CLERK_USER_ID` were not available.
- SQL verification - skipped because no staging database connection was available and seed did not run.

Notes:

- No `.env.local` backup or restore was needed because `.env.local` did not exist.
- Packet 7 remains blocked, not complete.
- To resume, provide a temporary ignored `.env.local` or equivalent local environment with dedicated staging `DATABASE_URL`, Clerk keys, redirect URLs, `HOTEL_APP_DEMO_MODE="false"`, and a real staging owner `SEED_CLERK_USER_ID`.

## 2026-06-01 Packet 8 Font Build Reliability Decision

Context:

- Removed the remote Google font import from the root layout.
- Replaced the generated Geist CSS variable with a deterministic system-local font stack.
- Updated PM docs so Google font fetching is no longer treated as an active release caveat.

Checks run:

```powershell
rg -n "next/font[/]google|Geist[_]Mono|font[-]geist|fonts[.]googleapis" src docs README.md
```

Result: passed by returning no matches after the source font change. This is the self-avoiding equivalent of the requested remote-font dependency search, so the validation log entry does not match its own pattern.

```powershell
bun run test
```

Result: passed. 65 tests passed across 5 files with 195 assertions.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: passed in the normal restricted environment. Build compiled successfully, completed TypeScript, generated 5 static pages, and did not require a Google font network fetch or approved network rerun.

```powershell
git diff --check
```

Result: passed. Git printed CRLF normalization warnings for existing modified files, but no whitespace errors or conflict markers.

```powershell
rg -n "[ \t]+$" docs/project-management src/app/layout.tsx src/app/globals.css
```

Result: passed by returning no matches for trailing whitespace in the touched docs/source files.

Notes:

- Packet 8 resolves R7 by removing remote font fetching from production build inputs.
- No font files, packages, schema changes, route changes, fixture changes, or room-state work were added.

## 2026-06-01 Packet 9 Production Auth And Membership Provisioning

Context:

- Added a production auth and membership provisioning runbook for pilot operations.
- The runbook documents current behavior: Clerk authenticates identity, while `hotel_memberships` controls app hotel access and roles.
- Clerk docs were checked for current invitation behavior before writing the runbook.

Checks run:

```powershell
git diff --check
```

Result: passed with CRLF normalization warnings only.

```powershell
rg -n "[ \t]+$" docs/project-management
```

Result: passed by returning no matches for trailing whitespace in PM docs.

```powershell
rg -n "[<]{7}|[=]{7}|[>]{7}" docs/project-management
```

Result: passed by returning no matches for merge conflict markers in PM docs.

Checks skipped:

- `bun run test` - skipped because Packet 9 changes documentation only.
- `bun run typecheck` - skipped because no type-checked source changed.
- `bun run lint` - skipped because no source behavior changed.
- `bun run build` - skipped because no runtime source or build inputs changed.

Notes:

- Pilot provisioning method is now manual Clerk invitation plus reviewed Neon SQL for `hotel_memberships` and `staff` rows.
- R6 is mitigated by documentation, but an admin UI or dedicated provisioning command remains future hardening.

## 2026-06-01 Packet 7 Resume Attempt - Vercel Preview Env

Context:

- Resumed Packet 7 using the selected Vercel Preview staging source.
- The repo is linked to Vercel project `hotel-management-web-app`.
- Vercel CLI was not installed globally, so `bunx vercel@latest` was used.

Checks run:

```powershell
bunx vercel@latest env pull .env.local --environment=preview --yes
```

Result: passed after elevated execution was allowed for `bunx`. `.env.local` was created from Vercel Preview.

```powershell
# Secret-safe preflight of required Packet 7 keys in .env.local.
```

Result: blocked. `.env.local` existed, but these required keys were missing or empty: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`, `HOTEL_APP_DEMO_MODE`, and `SEED_CLERK_USER_ID`. `HOTEL_APP_DEMO_MODE` was not confirmed as `"false"`.

```powershell
# Secret-safe key-name inspection of .env.local.
```

Result: passed. The file contained only Vercel system/build metadata keys such as `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_OIDC_TOKEN`, and git metadata keys; no app Clerk/Neon variables were present.

```powershell
bunx vercel@latest env ls preview
```

Result: passed. Vercel reported no custom Preview environment variables for the linked project.

Checks skipped:

- `bun run db:migrate` - skipped because no staging `DATABASE_URL` was available.
- `bun run db:seed` - skipped because staging Clerk/Neon values, `HOTEL_APP_DEMO_MODE="false"`, and `SEED_CLERK_USER_ID` were not available.
- SQL verification - skipped because migration and seed did not run.

Notes:

- Packet 7 remains blocked.
- To resume, add the required staging app variables to Vercel Preview for the linked project, then pull Preview envs again.
- `.env.local` remains ignored and must not be committed.

## 2026-06-01 Packet 7 Resume Attempt - Manual Staging Env

Context:

- Resumed Packet 7 after staging Clerk keys, a Neon database URL, and `SEED_CLERK_USER_ID` were provided.
- Wrote the values into ignored `.env.local` with `HOTEL_APP_DEMO_MODE="false"` and default hosted redirect paths.
- No secret values are recorded here.

Checks run:

```powershell
# Secret-safe preflight of required Packet 7 keys in .env.local.
```

Result: passed. `.env.local` exists, all required Packet 7 keys are present, `HOTEL_APP_DEMO_MODE` is exactly `"false"`, the database URL parses as a Neon host, and the database name is `neondb`.

```powershell
git check-ignore -v .env.local
```

Result: passed. `.env.local` is ignored by `.gitignore` and must not be committed.

```powershell
bun run db:migrate
```

Result: failed. Drizzle reached the Neon target and began applying migrations, but exited with code 1 without a detailed CLI error in the captured output.

```powershell
# Read-only Neon schema inspection.
```

Result: blocked. The database is not an empty staging target for this repo:

- Public tables already include app-like tables plus unrelated tables such as `approval_requests` and `rate_plans`.
- `drizzle.__drizzle_migrations` already exists with three migration records.
- Required repo tables `organizations` and `hotel_memberships` are missing.
- The local repo has one migration file, so the remote migration history does not match this repo's migration history.

Checks skipped:

- `bun run db:seed` - skipped because the migration did not pass and the target schema is incompatible with the seed assumptions.
- SQL seed verification - skipped because seed did not run.

Notes:

- Packet 7 remains blocked.
- Do not run seed against this database until the staging DB target is corrected.
- To resume safely, use a fresh empty staging Neon database for this repo, or explicitly approve a reset/migration strategy for the existing database.

## 2026-06-01 Packet 7B Reset Staging Neon DB And Re-run Migration/Seed

Context:

- Resumed Packet 7 with explicit approval to reset the staging Neon database because it contained sample data only.
- `.env.local` remained ignored and was used only after a secret-safe preflight.
- No source schema, migration generation, `db:push`, fixture, route, or room-state work was performed.

Checks run:

```powershell
# Secret-safe env preflight for DATABASE_URL, Clerk keys, redirect URLs,
# HOTEL_APP_DEMO_MODE, and SEED_CLERK_USER_ID.
```

Result: passed. `.env.local` exists, is ignored by Git, all required keys are present, `HOTEL_APP_DEMO_MODE` is exactly `"false"`, `SEED_CLERK_USER_ID` matches the approved staging owner, the database URL parses as a Neon host, and the database name is `neondb`.

```sql
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
```

Result: passed. The approved staging Neon schema reset completed.

```powershell
bun run db:migrate
```

Result: passed. Drizzle reached the reset Neon target and applied migrations successfully.

```powershell
bun run db:seed
```

Result: failed before seed SQL ran. `tsx` reported that top-level await in `src/db/seed.ts` is not supported with the current CommonJS output path, then exited with code 1.

```powershell
git diff --check
```

Result: passed after PM doc updates. Git printed CRLF normalization warnings for existing modified files, but no whitespace errors or conflict markers.

```powershell
rg -n "[ \t]+$" docs/project-management
```

Result: passed by returning no matches for trailing whitespace in PM docs.

Checks skipped:

- Non-secret SQL seed verification - skipped because `bun run db:seed` failed.
- Packet 7 completion update - skipped because seed and verification did not pass.

Notes:

- Packet 7 remains blocked, not complete.
- The staging database is now reset and migrated, but not seeded.
- Next step is to fix the seed runner compatibility issue, then rerun `bun run db:seed` and the non-secret SQL verification.

## 2026-06-01 Packet 7C Fix Seed Runner Compatibility And Complete Hosted Seed Validation

Context:

- Fixed `bun run db:seed` so `src/db/seed.ts` can run under the existing `tsx` command.
- Seed behavior was kept the same; the change removed CLI-incompatible top-level await and server-only imports from the seed runner path.
- Used the already reset and migrated staging Neon database from Packet 7B.

Checks run:

```powershell
bun run db:seed
```

Result: failed once after the top-level-await wrapper fix because `src/db/seed.ts` still imported app server-only modules through `@/lib/db` and `@/lib/hotel-service`. The seed script was changed to use Neon directly and a local seed ID helper, without changing seeded data.

```powershell
bun run db:seed
```

Result: passed. Output confirmed realistic hosted hotel demo data was seeded for the approved staging owner.

```powershell
# Non-secret SQL verification against staging Neon.
```

Result: passed.

Counts:

- Missing required tables: none.
- `org_demo_portfolio`: `1`.
- Active hotels under `org_demo_portfolio`: `2`.
- Active owner memberships for the approved staging owner: `2`.
- Rooms: `98`.
- Guests: `64`.
- Reservations: `64`.
- Staff: `16`.
- Housekeeping tasks: `10`.
- Maintenance tickets: `12`.
- Booking requests: `8`.
- Seed audit logs: `2`.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run test
```

Result: passed. 65 tests passed across 5 files with 195 assertions.

```powershell
git diff --check
```

Result: passed after Packet 7C updates. Git printed CRLF normalization warnings for existing modified files, but no whitespace errors or conflict markers.

```powershell
rg -n "[ \t]+$" docs/project-management src/db/seed.ts
```

Result: passed by returning no matches for trailing whitespace in the touched docs/source files.

Notes:

- Packet 7 is complete after Packet 7C.
- No schema, fixture data, room-state modeling, provisioning docs, or source behavior outside the seed runner path was changed.

## 2026-06-01 Packet 10 Routing And Access UX Validation

Context:

- Implemented Packet 10 sign-in redirect behavior and `/portfolio` membership no-access UX.
- Added focused page-routing coverage in `test/page-routing-packet10.test.tsx`.
- Kept the behavior scoped to sign-in/portfolio and test updates.

Checks run:

```powershell
bun run test
```

Result: passed after updating the package test script to run Bun with per-file isolation for module-mock-heavy tests. 71 tests passed across 6 files with 227 assertions.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: passed.

```powershell
git diff --check
```

Result: passed. No whitespace/merge-marker errors in current changes.

```powershell
rg -n "[ \t]+$" docs/project-management src/app/sign-in/[[...sign-in]]/page.tsx src/app/portfolio/page.tsx test/page-routing-packet10.test.tsx package.json
```

Result: passed by returning no matches for trailing whitespace in touched Packet 10 files.

Notes:

- Invite-only sign-in remains disabled with `withSignUp={false}` and an empty `signUpUrl`.
- Signed-in visits to `/sign-in` redirect to `/portfolio`.
- `/portfolio` now shows a clear no-access state for signed-in users without active hotel memberships.
- `bun run test` remains the official release-gate command; its package script now uses Bun isolation to prevent cross-file module mock leakage.
- Manager acceptance review reran `bun run test`, `bun run typecheck`, `bun run lint`, and `bun run build` successfully after the Packet 10 handoff.

## 2026-06-01 Packet 11 Hosted Clerk Middleware And Mobile Sign-In Hotfix

Context:

- Hosted production smoke testing on PC and iPhone 15 Pro Max showed flashing after sign-in and sign-in UI overflow on mobile.
- Root-cause assessment: the app used Clerk server helpers through `getIdentity()` but did not include project middleware, so hosted server identity resolution could fail after client sign-in and create a `/sign-in` and `/portfolio` loop.
- Added Clerk middleware and constrained the sign-in page/auth card for mobile widths.

Checks run:

```powershell
bun run test
```

Result: passed. 72 tests passed across 7 files with 232 assertions.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: passed. Build output included `Proxy (Middleware)`, confirming the middleware is part of the Next/Vercel build.

Notes:

- Added `middleware.ts` with `clerkMiddleware()`.
- Added `test/middleware-packet11.test.ts` and expanded page-routing coverage for responsive auth classes.
- Mobile sign-in CSS now constrains Clerk root/card boxes to the panel width and prevents horizontal overflow.

## 2026-06-01 Packet 12 Hosted Hotel Dashboard Date Crash And Mobile Topbar

Context:

- Hosted production smoke testing reached the portfolio, but clicking into a hotel showed minified React error #31 with `[object Date]`.
- React error #31 means an object was rendered as a React child; the dashboard payload expected date strings while Neon/SQL rows can provide JavaScript `Date` objects.
- The signed-in mobile topbar also stacked awkwardly on iPhone 15 Pro Max.

Checks run:

```powershell
bun run test
```

Result: passed. 73 tests passed across 8 files with 240 assertions.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: passed. Build output still included `Proxy (Middleware)`.

Notes:

- Added service-layer normalization for guest, reservation, booking-request, housekeeping, maintenance, and audit date fields.
- Added `test/date-normalization-packet12.test.ts` to cover Neon-style `Date` rows before React rendering.
- Updated the mobile topbar to keep brand, workspace/home action, and account controls on one compact row.

## 2026-06-01 Packet 13 Mobile Dashboard Density And Export Placement

Context:

- Hosted smoke testing passed sign-in, portfolio, hotel click-through, and iPhone topbar checks.
- Follow-up UX notes: metric cards had too much empty space on iPhone, and CSV/backup downloads were too prominent in the hotel page title.

Checks run:

```powershell
bun run test
```

Result: passed. 74 tests passed across 9 files with 244 assertions.

```powershell
bun run typecheck
```

Result: passed.

```powershell
bun run lint
```

Result: passed.

```powershell
bun run build
```

Result: passed. Build output still included `Proxy (Middleware)`.

Notes:

- Mobile metric cards now use compact two-column tiles.
- Owner/manager export links moved from the page title to a `Data exports` panel.
- Added `test/hotel-workspace-packet13.test.tsx` to cover export placement.
