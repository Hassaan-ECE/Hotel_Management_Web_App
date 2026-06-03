# Backlog

Last updated: 2026-06-02

Priority scale:

- P0: blocks shipping or could cause serious data/security issues.
- P1: important for realistic pilot workflows.
- P2: useful improvement after the core pilot path is stable.

## P0

### Fix Cross-Hotel Guest ID Isolation

Status: completed on 2026-06-01.

Acceptance criteria:

- `saveGuest` does not update rows outside the current hotel when a caller supplies an existing guest id from another hotel.
- `createWalkInReservation` rejects a provided `guestId` unless it belongs to the current hotel.
- Same-hotel guest updates and new walk-in guest creation continue to work.
- A regression test or focused validation covers the cross-hotel guest-id case.

### Add Automated Coverage For Critical Domain Workflows

Status: partially complete. Packets 3 and 5 added the Bun test foundation with focused tenant-isolation, input-validation, route authorization, workflow-transition, demo-parity, and cross-hotel housekeeping tests; broader browser smoke coverage and future payment revenue rules remain open.

Acceptance criteria:

- Test framework is chosen and documented.
- Coverage exists for hotel isolation, role authorization, demo mode service behavior, reservation status transitions, housekeeping task transitions, maintenance ticket transitions, and revenue rules once payments exist.
- Tests run with a Bun command and are added to validation docs.

### Document Hosted Environment Setup

Status: completed on 2026-06-01.

Acceptance criteria:

- `.env.example`, `docs/project-management/hosted-environment-setup.md`, and root `README.md` cover Clerk, Neon, demo mode, seed user, organization, and Vercel variables.
- Hosted setup can be followed without relying on chat history.
- `HOTEL_APP_DEMO_MODE` behavior is explicitly separated from production/staging behavior.
- `.env.example` can be tracked normally while real `.env*` files stay ignored.
- `docs/project-management/active-sprint.md`, `release-checklist.md`, and `validation-log.md` reflect completion and verification of this setup packet.
- Validation log records setup-command checks and skipped checks for this packet.

### Preserve Tenant Isolation In Every New Data Path

Status: ongoing project rule. Packet 1 added guest-path regression coverage and Packet 3 added representative route tenant-denial coverage.

Acceptance criteria:

- Every query and mutation involving operational data filters by `hotel_id`.
- Review checklist includes tenant isolation before merge.
- Tests or targeted checks cover cross-hotel access denial for critical endpoints.

### Harden Route And Domain Inputs

Status: P0 hardening complete on 2026-06-01. Search limit parsing, housekeeping task status validation, and semantic workflow guards are in place; deeper room-state modeling remains P1.

Acceptance criteria:

- Search `limit` parsing handles invalid values without producing invalid SQL.
- Housekeeping task statuses are constrained to known workflow states.
- Service methods reject semantically invalid reservation, housekeeping, and maintenance transitions where practical.
- API routes return clear client errors for invalid input.

## P1

### Split Room State Into Real Operational Concepts

Acceptance criteria:

- Schema distinguishes housekeeping condition, occupancy state or derived occupancy, and maintenance blocking.
- Existing room status behavior is migrated without data loss.
- UI labels and filters reflect the separated states.
- Seed and demo stores use the same concepts where practical.

### Add Payment Transaction Model

Acceptance criteria:

- Durable payments model supports captures, declines, refunds, cash, checks, and repeated attempts.
- Manager and owner revenue metrics use revenue-eligible transactions.
- Declines are visible as failed payment activity but excluded from revenue.
- Existing fixture payment events can be persisted or loaded through a clear path.

### Build Release Checklist

Status: completed as a checklist on 2026-06-01. `release-checklist.md` includes test, typecheck, lint, build, migration, seed validation, and manual role smoke checks; live DB migration/seed execution remains environment-specific.

Acceptance criteria:

- Release checklist includes typecheck, lint, build, migrations, seed validation, and manual role smoke tests.
- Checklist records exact commands and expected outcomes.
- Validation log links to the latest completed run.

### Clarify Real Production Auth Flow

Status: completed for pilot operations on 2026-06-01. A manual runbook now covers Clerk invitations, app database memberships, role changes, and staff deactivation. Admin UI or scripted provisioning remains a future hardening option.

Acceptance criteria:

- Done: Clerk invitation flow is documented.
- Done: App-level hotel membership creation flow is defined.
- Done: Owner, manager, and staff provisioning paths are explicit.
- Done: Removing a user from a hotel is covered.
- Done: Invite-only sign-in routing and no-membership portfolio UX are validated.

### Split Front Desk Workflows Into Focused Pages

Status: completed on 2026-06-02.

Acceptance criteria:

- Done: Front-desk hub, walk-in creation, and active reservations live on focused routes.
- Done: Search updates while typing and ranks exact, prefix, substring, and all-token matches.
- Done: Walk-in creation no longer shares the main workspace layout and still auto-creates guests through the reservation workflow.
- Done: Active reservations can be filtered, sorted, checked in, and checked out from a dedicated table page.
- Done: Booking board shows active reservation spans by room across a custom date range.

### Front Desk Booking Board And Readiness Polish

Status: completed on 2026-06-02.

Acceptance criteria:

- Done: Booking board date controls use inline labels with better spacing.
- Done: Booking board hides empty rooms by default and compresses longer ranges instead of requiring drag/scroll.
- Done: Booking board uses a shared timeline scale so reservation bars align proportionally across room rows.
- Done: Booking board positions bars absolutely over the shared timeline and marks bars clipped by the selected range.
- Done: Booking board is now the default reservations view with a compact 7-day range.
- Done: Booking board bars show guest names only; clipped stays use subtle squared-edge borders instead of legends, arrows, or visible meta text.
- Done: Reservation table entries and booking-board bars open a hotel-scoped reservation detail page.
- Done: Check-out actions require confirmation before mutating reservation/room/housekeeping state.
- Done: Front-desk hub room readiness moved below the main workflow and now summarizes ready-to-sell rooms, housekeeping needs, blocked rooms, departures, and room-type availability.
- Done: Walk-in page no longer includes the extra `Available rooms` side panel and now groups guest, stay, and rate/notes fields with date inputs that stack before they can overflow.

## P2

### API Contract Documentation

Acceptance criteria:

- Each API route has method, role access, request shape, response shape, and major errors documented.
- Docs distinguish demo-only behavior from hosted database behavior.

### Manual QA Scripts By Role

Status: partially complete. Packet 15 added gated one-account Admin role preview for hosted smoke testing; written step-by-step scripts and browser automation are still open.

Acceptance criteria:

- Role-based smoke scripts exist for owner, manager, front desk, housekeeping supervisor, housekeeper, and maintenance.
- Scripts include demo credentials and expected UI outcomes.

### Gated Admin Role Preview For Hosted QA

Status: completed on 2026-06-02.

Acceptance criteria:

- Done: Real `owner` membership remains the source of Admin authority.
- Done: Preview is disabled by default and requires `HOTEL_APP_ROLE_PREVIEW_ENABLED="true"`.
- Done: Preview is restricted to explicit Clerk user ids through `HOTEL_APP_ROLE_PREVIEW_USER_IDS`.
- Done: Preview changes the effective server role for the active hotel without mutating `hotel_memberships`.
- Done: Housekeeper preview requires an active same-hotel staff row and uses that staff id for assigned housekeeping work.
- Done: Focused tests cover schema validation, route gating, authz behavior, UI rendering, and housekeeping staff scoping.

### Clean Clone Setup Verification

Status: completed on 2026-06-01.

Acceptance criteria:

- Done: A clean copied worktree followed `README.md` and `.env.example` without chat history.
- Done: Release gates ran from the documented commands after `bun install`.
- Done: The release checklist now documents the clean-environment setup sequence.

### Font Build Reliability

Status: completed on 2026-06-01.

Acceptance criteria:

- Done: Production builds no longer depend on live Google font fetches.
- Done: The app uses deterministic system-local font stacks.
- Done: `bun run build` passed without an approved network rerun.
