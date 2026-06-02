# Active Sprint

Last updated: 2026-06-02

## Sprint Goal

Stabilize the hosted app foundation before expanding product scope. Tenant isolation, input hardening, workflow guards, test foundation, hosted setup docs, clean-copy release-gate verification, deterministic font builds, pilot auth provisioning docs, hosted staging migration/seed validation, invite-only auth routing UX, hosted Clerk middleware/mobile sign-in hotfix, hosted hotel dashboard date/mobile-topbar fixes, mobile dashboard density/export placement polish, admin/export naming polish, gated Admin role preview, and account-modal role preview placement are now in place.

## Current Acceptance Criteria

- P0 tenant-isolation issue in guest save and walk-in reservation paths is fixed.
- Search limit parsing cannot produce invalid SQL limits.
- Housekeeping task status inputs are constrained to known workflow states.
- Reservation, housekeeping, and maintenance workflow jumps are guarded in production and demo mode.
- Validation commands are run and recorded after each implementation packet.
- Any delegated implementation task has a bounded file ownership scope and a manager review pass.
- Clean-clone setup and hosted migration/seed validation are complete before M2 schema work starts.
- Signed-in real-Clerk users do not remain on `/sign-in`, and signed-in users without active hotel memberships see a clear no-access state.
- Hosted Clerk sign-in can resolve server identity after sign-in without a `/sign-in` and `/portfolio` redirect loop.
- The sign-in page fits iPhone 15 Pro Max width without horizontal overflow.
- Hotel workspace payload dates are normalized before React rendering so Neon `Date` objects cannot crash the dashboard.
- Mobile topbar keeps brand, workspace navigation, and account controls on one compact row.
- Metric cards are denser on phone widths, and manager export actions are moved out of the page title into a dedicated data exports panel.
- The top-level `owner` permission is presented as Admin in the UI, and export downloads use hotel-specific filenames.
- Admin role preview is feature-flagged, Clerk-user allow-listed, real Admin-only, scoped per hotel, and validates Housekeeper preview against active same-hotel staff.
- Role preview controls live inside the account/profile modal, not in the hotel workspace layout.

## Next Implementation Packets

### Packet 1 - Tenant Isolation Hotfix

Status: completed on 2026-06-01.

Owner: GPT-5.3-Codex-Spark implementer, reviewed by manager.

Likely files:

- `src/lib/hotel-service.ts`
- `src/lib/demo-store.ts` only if demo behavior needs parity.
- Focused tests if a test framework is added first.

Acceptance criteria:

- Done: `saveGuest` cannot update or return a guest that belongs to another hotel.
- Done: `createWalkInReservation` verifies a provided `guestId` belongs to the active hotel before linking it.
- Done: Cross-hotel and missing guest IDs fail with a clear error.
- Done: Existing same-hotel guest update and new guest creation behavior remains intact.
- Done: Bun regression tests cover production service behavior and demo-store parity.

### Packet 2 - Route Input Hardening

Status: completed on 2026-06-01.

Owner: GPT-5.3-Codex-Spark implementer, reviewed by manager.

Likely files:

- `src/app/api/hotels/[hotelId]/search/route.ts`
- `src/lib/validation.ts`
- `src/lib/hotel-service.ts`

Acceptance criteria:

- Done: Search `limit` handles empty, invalid, decimal, negative, and oversized values predictably.
- Done: `searchFrontDesk` defensively normalizes direct service-call limits before SQL.
- Done: Housekeeping task status input is constrained to allowed statuses.
- Done: API errors continue through the existing validation/400 response path.
- Done: Bun regression tests cover limit normalization, SQL limit propagation, and housekeeping status validation.

### Packet 3 - Test Foundation

Status: completed on 2026-06-01.

Owner: manager plans, Spark implements bounded setup.

Likely files:

- `package.json`
- new test config and test files.

Acceptance criteria:

- Done: Test framework works with Bun through `bun run test`.
- Done: Initial tests cover tenant isolation and input hardening from Packets 1 and 2.
- Done: Added service workflow tests for reservation, housekeeping, and maintenance transitions.
- Done: Added route auth tests for representative role and tenant denial paths.
- Done: Test command is documented in `validation-log.md`, `testing.md`, and `release-checklist.md`.

### Packet 4 - Hosted Environment Setup Documentation

Status: completed on 2026-06-01.

Owner: manager plans, Spark implements bounded setup.

Likely files:

- `docs/project-management/hosted-environment-setup.md`
- `docs/project-management/README.md`
- `docs/project-management/release-checklist.md`
- `docs/project-management/backlog.md`
- `docs/project-management/active-sprint.md`
- `docs/project-management/validation-log.md`
- `.env.example`
- `README.md`
- `docs/project-management/agent-workflow.md` or `docs/project-management/decision-log.md` (for Spark/reasoning model notes).

Acceptance criteria:

- Done: Hosted setup document covers local demo mode, local real-service mode, staging, production, and intentional demo-only preview behavior.
- Done: `.env.example` comments align with staging/production demo-mode requirements.
- Done: `.gitignore` allows `.env.example` to be tracked while keeping real `.env*` files ignored.
- Done: Hosted setup and seed workflow are discoverable from project docs.
- Done: `release-checklist.md` includes migration/seed validation expectations.
- Done: `validation-log.md` records packet checks and skipped checks.

### Packet 5 - Finish Remaining P0 Hardening

Status: completed on 2026-06-01.

Owner: manager implemented after GPT-5.3-Codex-Spark was unavailable due capacity, reviewed by manager.

Likely files:

- `src/lib/validation.ts`
- `src/lib/hotel-service.ts`
- `src/lib/demo-store.ts`
- Workflow guard tests.
- PM docs.

Acceptance criteria:

- Done: Invalid reservation, housekeeping, and maintenance workflow jumps return clear `badRequest` errors.
- Done: Same-hotel valid reservation, housekeeping, and maintenance transitions still pass.
- Done: Reservation same-status updates are idempotent and do not duplicate checkout turnover tasks.
- Done: Cross-hotel housekeeping assignment, action, and issue-report paths are explicitly tested.
- Done: Demo-store workflow guards match production behavior, including send-back returning work to `dirty`.
- Done: `bun run test`, `bun run typecheck`, `bun run lint`, and `git diff --check` results are recorded.

### Packet 6 - Clean Clone And Release Gate Verification

Status: completed on 2026-06-01.

Owner: manager plans, implementer or manager runs verification.

Likely files:

- `README.md`
- `.env.example`
- `docs/project-management/release-checklist.md`
- `docs/project-management/validation-log.md`

Acceptance criteria:

- Done: Verified setup from a clean copied worktree using documented commands.
- Done: Confirmed `.env.example` is commit-eligible and sufficient for local demo-mode setup.
- Done: Ran `bun install`, `bun run test`, `bun run typecheck`, `bun run lint`, and `bun run build`.
- Done: Recorded exact command results and build font behavior.
- Done: Updated the release checklist to make clean-environment setup explicit.

### Packet 7 - Real Hosted Migration And Seed Validation

Status: completed on 2026-06-01 after Packet 7C fixed the seed runner and verified staging seed results.

Owner: manager plans; implementer runs with explicit staging Clerk/Neon credentials.

Likely files:

- `docs/project-management/hosted-environment-setup.md`
- `docs/project-management/release-checklist.md`
- `docs/project-management/validation-log.md`

Acceptance criteria:

- Use `HOTEL_APP_DEMO_MODE="false"` with dedicated staging Clerk and Neon resources.
- Run `bun run db:migrate` and `bun run db:seed` against staging.
- Verify seeded hotels, organization, and owner memberships with SQL checks.
- Confirm staging does not silently fall back to demo mode.
- Record exact commands, environment scope, and non-secret validation results.

Completion status:

- Done: Required Clerk/Neon values were provided manually and `.env.local` passed secret-safe required-key preflight.
- Done: The approved staging Neon schema reset completed.
- Done: `bun run db:migrate` passed after the reset and applied the repo migration.
- Done: `bun run db:seed` passed after the seed runner compatibility fix.
- Done: Non-secret SQL verification confirmed required app tables, two seeded hotels, `org_demo_portfolio`, owner memberships for the approved staging owner, and expected fixture counts.

### Packet 8 - Font Build Reliability Decision

Status: completed on 2026-06-01.

Owner: manager decision, implementer if local-font migration is selected.

Likely files:

- `src/app/layout.tsx`
- `src/app/globals.css` or font assets under `public/`
- `docs/project-management/risk-register.md`
- `docs/project-management/release-checklist.md`

Acceptance criteria:

- Done: Decided production builds should not require network font fetches.
- Done: Switched to deterministic system-local font stacks.
- Done: Verified `bun run build` without a Google font fetch.
- Done: Updated R7 in the risk register with the final decision.

### Packet 9 - Production Auth And Membership Provisioning

Status: completed on 2026-06-01.

Owner: manager plans, implementer documents or builds the selected provisioning path.

Likely files:

- `docs/project-management/hosted-environment-setup.md`
- new provisioning runbook if needed
- `docs/project-management/risk-register.md`
- `docs/project-management/backlog.md`

Acceptance criteria:

- Done: Documented Clerk invitation flow.
- Done: Defined how app-level hotel memberships are created, changed, and deactivated.
- Done: Made owner, manager, and staff provisioning explicit.
- Done: Stated pilot provisioning is manual Clerk + Neon operation until admin UI or script exists.
- Done: Updated R6 with the runbook mitigation.

### Packet 10 - Hosted Auth Routing And Access UX

Status: completed on 2026-06-01.

Owner: manager plans, implementer and reviewer.

Likely files:

- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/portfolio/page.tsx`
- `test/page-routing-packet10.test.tsx`
- `package.json`
- `docs/project-management/testing.md`
- `docs/project-management/active-sprint.md`
- `docs/project-management/validation-log.md`

Acceptance criteria:

- Done: In real Clerk mode, `/sign-in` redirects signed-in users to `/portfolio` after setup checks.
- Done: In real Clerk mode, `/sign-in` renders Clerk `<SignIn />` for signed-out users with:
  - `routing="path"`
  - `path="/sign-in"`
  - `forceRedirectUrl="/portfolio"`
  - `fallbackRedirectUrl="/portfolio"`
  - `withSignUp={false}`
  - no public sign-up surface.
- Done: `/portfolio` for signed-out users still redirects to `/sign-in`.
- Done: `/portfolio` for signed-in users with no memberships renders a clear no-access panel with `AppTopbar`.
- Done: `/portfolio` preserves `requireAnyHotelSession` behavior for membershiped users.
- Done: Added focused Bun page-routing tests covering signed-in/signed-out `/sign-in` and `/portfolio` membership/role states.

### Packet 11 - Hosted Clerk Middleware And Mobile Sign-In Hotfix

Status: completed on 2026-06-01.

Owner: manager implements and verifies.

Likely files:

- `middleware.ts`
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/globals.css`
- `test/middleware-packet11.test.ts`
- `test/page-routing-packet10.test.tsx`

Acceptance criteria:

- Done: Add Clerk middleware so server-side `auth()` and `currentUser()` can resolve identities in hosted mode.
- Done: Preserve invite-only sign-in and `/portfolio` redirect behavior.
- Done: Constrain the Clerk sign-in card and auth panel so mobile widths do not overflow.
- Done: Add regression coverage proving middleware is exported and sign-in uses responsive auth classes.
- Done: Run test, typecheck, lint, build, and whitespace checks before deployment.

### Packet 12 - Hosted Hotel Dashboard Date Crash And Mobile Topbar

Status: completed on 2026-06-01.

Owner: manager implements and verifies.

Likely files:

- `src/lib/hotel-service.ts`
- `src/components/app-topbar.tsx`
- `src/app/globals.css`
- `test/date-normalization-packet12.test.ts`
- PM docs.

Acceptance criteria:

- Done: Normalize SQL `date` and `timestamp` outputs to strings before returning hotel dashboard payloads.
- Done: Cover Neon-style `Date` rows with a focused service regression test.
- Done: Keep the signed-in mobile topbar to one compact row with brand, workspace/home action, and account control.
- Done: Run test, typecheck, lint, build, and whitespace checks before deployment.

### Packet 13 - Mobile Dashboard Density And Export Placement

Status: completed on 2026-06-01.

Owner: manager implements and verifies.

Likely files:

- `src/components/hotel-workspace.tsx`
- `src/app/globals.css`
- `test/hotel-workspace-packet13.test.tsx`
- PM docs.

Acceptance criteria:

- Done: Mobile metric cards use a compact two-column layout with less vertical whitespace.
- Done: CSV and backup downloads are removed from the page title.
- Done: Owner/manager downloads live in a dedicated `Data exports` panel.
- Done: Add render coverage for export placement.
- Done: Run test, typecheck, lint, build, and whitespace checks before deployment.

### Packet 14 - Admin Label And Hotel-Specific Export Names

Status: completed on 2026-06-01.

Owner: manager implements and verifies.

Likely files:

- `src/lib/roles.ts`
- `src/lib/downloads.ts`
- `src/components/portfolio-dashboard.tsx`
- `src/components/hotel-workspace.tsx`
- `src/app/api/hotels/[hotelId]/exports/[report]/route.ts`
- `src/app/api/hotels/[hotelId]/backup/route.ts`
- `test/download-filenames-packet14.test.ts`
- PM docs.

Acceptance criteria:

- Done: Present the top-level app role as Admin in user-facing UI while preserving internal `owner` authorization semantics.
- Done: Do not rely on Clerk public metadata for hotel roles.
- Done: Export button labels are clearer.
- Done: Downloaded CSV/backup filenames include the hotel name.
- Done: Add focused tests for sanitized hotel-specific filenames and response headers.
- Done: Run test, typecheck, lint, build, and whitespace checks before deployment.

### Packet 15 - Admin Role Preview

Status: completed on 2026-06-02.

Owner: manager implements and verifies.

Likely files:

- `src/lib/authz.ts`
- `src/components/hotel-workspace.tsx`
- `src/app/api/hotels/[hotelId]/role-preview/route.ts`
- `src/app/hotels/[hotelId]/page.tsx`
- `.env.example`
- focused Packet 15 tests and PM docs.

Acceptance criteria:

- Done: Keep real database membership role as `owner`, presented as Admin.
- Done: Add env gates `HOTEL_APP_ROLE_PREVIEW_ENABLED` and `HOTEL_APP_ROLE_PREVIEW_USER_IDS`, default off.
- Done: Restrict preview controls and route handlers to real Admin users who are explicitly allow-listed.
- Done: Store preview state in a short-lived HTTP-only cookie scoped by hotel id.
- Done: Make `requireHotelSession` use the preview role as the effective server role while preserving `actualRole`.
- Done: Validate Housekeeper preview against active same-hotel staff and use the selected staff id for assigned housekeeping work.
- Done: Add focused schema, authz, route, UI, and service tests.

### Packet 16 - Move Role Preview Into Account Modal

Status: completed on 2026-06-02.

Owner: manager implements and verifies.

Likely files:

- `src/components/account-user-button.tsx`
- `src/components/app-topbar.tsx`
- `src/components/hotel-workspace.tsx`
- `src/app/hotels/[hotelId]/page.tsx`
- `src/app/globals.css`
- focused component tests.

Acceptance criteria:

- Done: Remove the visible role preview panel from the hotel workspace layout.
- Done: Add the role dropdown under the Clerk account/profile modal for the active hotel.
- Done: Preserve the same server-side preview route and real Admin gating from Packet 15.
- Done: Keep Housekeeper preview staff selection available in the account modal.
- Done: Add tests proving the workspace layout does not render preview controls and the account profile page does.

## Manager Review Focus

- Do not broaden scope into room-state schema work during release-foundation cleanup.
- Verify every database path is filtered by `hotel_id`.
- Confirm no unrelated realistic fixture or seed work is reverted.
- Record actual validation, including failures.
