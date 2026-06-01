# Risk Register

Last updated: 2026-06-01

## Active Risks

### R0 - Cross-Hotel Guest IDs Can Affect Guest Paths

Severity: critical

Status: mitigated on 2026-06-01 by Packet 1; keep regression coverage and tenant-isolation review active for new data paths.

The risk audit found two tenant-isolation weaknesses in guest-related paths:

- `saveGuest` upserts by global guest id and can target a guest row from another hotel if a caller supplies that id.
- `createWalkInReservation` accepts a supplied `guestId` without first proving it belongs to the current hotel.

Mitigation:

- Done: require `guestId + hotel_id` ownership checks before updates or reservation links.
- Done: add regression tests for cross-hotel and missing guest id rejection in database-mode service behavior and demo-store parity.
- Continue checking every new hotel-scoped data path for `hotel_id` filtering.

### R1 - Room Status Is Overloaded

Severity: high

The current schema uses `rooms.status` for availability, occupancy, housekeeping progress, readiness, and maintenance blocking. Real hotel data shows housekeeping condition and occupancy are separate operational facts.

Mitigation:

- Prioritize the room-state schema split before deeper housekeeping and reporting work.
- Add migration and tests around state transitions.

### R2 - Payment Data Is Not Durable Yet

Severity: high

Fixture payment events exist, but the schema has no payment transaction table. Current revenue is derived from reservations and cannot accurately represent captures, refunds, declines, split tender, or repeated attempts.

Mitigation:

- Add a payment model before relying on revenue metrics for pilot decisions.
- Ensure declined attempts are counted as failures, not revenue.

### R3 - Automated Test Coverage Is Still Young

Severity: medium

Packet 3 added a focused Bun test suite, but the app still has many role-specific mutation paths where regressions could be subtle. Browser-level role smoke tests and future payment/revenue coverage are not complete yet.

Mitigation:

- Done: add focused tests around service-layer invariants and representative role-gated API routes.
- Continue adding tests for new hotel-scoped reads and mutations.
- Add or run role smoke tests before hosted pilot readiness.

### R4 - Invalid Inputs Can Reach Service Logic

Severity: medium

Status: mitigated for known P0 paths by Packets 2 and 5; continue applying the same pattern to new workflow surfaces.

Search limit parsing can produce invalid SQL limits if the query parameter is malformed. Housekeeping task creation currently accepts arbitrary status strings even though downstream workflows assume known states.

Mitigation:

- Done: clamp and default search limit through validation.
- Done: add housekeeping task status schema.
- Done: add transition guards for critical reservation, housekeeping, and maintenance flows with demo parity and regression tests.

### R5 - Multi-Write Mutations Are Not Transactional

Severity: medium

Walk-ins, reservation status updates, maintenance updates, and housekeeping transitions perform multiple writes without explicit transaction boundaries. A failure between writes could leave inconsistent state.

Mitigation:

- Prioritize transactions for multi-write paths after the tenant-isolation hotfix.
- Add tests around failure-prone state transitions where practical.

### R6 - Hosted Auth Provisioning Is Not Fully Documented

Severity: medium

Status: mitigated on 2026-06-01 by Packet 9 manual provisioning runbook; admin UI or a dedicated provisioning command remains a future improvement.

The app uses Clerk identity and database hotel memberships, but the exact production provisioning flow needs a repeatable operator process.

Mitigation:

- Done: document required hosted environment variables, real-service mode, and seed-owner behavior.
- Done: document Clerk invite, app membership creation, role change, staff row, and deactivation workflows.
- Continue to prefer an admin UI or reviewed provisioning script before broad production rollout.
- Keep authorization checks server-side and near data access.

### R7 - Production Build Font Fetch Needs Network

Severity: medium

Status: resolved on 2026-06-01 by Packet 8.

Earlier builds failed when sandboxed network access blocked Google font fetching. Packet 8 removed the remote Google font dependency and switched the app to deterministic system-local font stacks.

Mitigation:

- Done: remove remote Google font fetch from production build inputs.
- Done: verify `bun run build` passes without approved network access.
- Treat any future remote font import or network font fetch as a release-gate regression unless explicitly reapproved.

### R8 - Existing Uncommitted Work Must Be Preserved

Severity: medium

The repo already had modified demo/seed files and new fixture/docs/scripts before this PM setup work.

Mitigation:

- Do not revert unrelated changes.
- Review diffs before implementation work that touches seed, demo store, or fixture paths.

## Review Triggers

Run a security or data-isolation review when changing:

- Auth, Clerk, cookies, sessions, memberships, or role checks.
- Any API route or service query that reads or mutates hotel-scoped data.
- Exports, backups, seed data, fixtures, or PII handling.
- Payment, revenue, or audit log behavior.
