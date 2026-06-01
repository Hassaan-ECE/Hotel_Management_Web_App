# Roadmap

Last updated: 2026-06-01

## M0 - Baseline And Coordination

Status: completed on 2026-06-01

Acceptance criteria:

- Project-management docs exist and are treated as the coordination source of truth.
- Current app surface, validation status, and major risks are recorded.
- Existing uncommitted user work is preserved.
- Next implementation packets can be delegated cleanly to GPT-5.3-Codex-Spark and reviewed by the manager.

## M1 - Release Foundation

Status: completed on 2026-06-01

Goal: make the existing app dependable enough to iterate toward a hosted pilot.

Acceptance criteria:

- Done: local setup works from a clean copied worktree using Bun.
- Done: environment variables for demo, Clerk, Neon, seeding, and Vercel are documented.
- `bun run test`, `bun run typecheck`, `bun run lint`, and `bun run build` are expected release gates.
- Done: a basic automated test strategy is added for domain services and critical API routes.
- Done: known P0 workflow hardening is implemented for tenant isolation, unsafe inputs, and invalid status transitions.
- Done: a repeatable local release checklist records the current release gates.
- Done: migration and seed validation expectations are documented for hosted release candidates.
- Done: deterministic font-build decision is implemented with system-local font stacks.
- Done: production auth and membership provisioning is documented for pilot operations.
- Done: hosted staging migration and seed validation passed against Neon after Packet 7C.
- Done: invite-only Clerk sign-in routing and no-membership portfolio access UX are covered by page-routing tests.

## M2 - Real Hotel Data Model

Status: next.

Goal: align the schema with realistic hotel operations.

Acceptance criteria:

- Room housekeeping condition is separated from occupancy and maintenance state.
- Realistic 46-room and 52-room fixture hotels persist cleanly in seed data.
- Housekeeping views can distinguish stayover, departing, vacant, arrival-due, inspection, blocked, and ready contexts.
- Data remains isolated by `hotel_id` in every query and mutation.
- Migration and seed paths are documented and validated.

## M3 - Payments And Revenue

Goal: model payment activity accurately enough for real hotel reporting.

Acceptance criteria:

- Payment transaction table or equivalent durable model exists.
- Captures, refunds, declines, cash, checks, and repeated attempts are represented.
- Revenue metrics exclude declined payment attempts.
- Payment summaries support owner and manager dashboards.
- Fixtures and validation cover the revenue/decline distinction.

## M4 - Role Workflow Hardening

Goal: make each operational role reliable, constrained, and ergonomic.

Acceptance criteria:

- Owner, manager, front desk, housekeeping supervisor, housekeeper, and maintenance flows have explicit acceptance checks.
- Housekeeping roles do not expose guest PII unnecessarily.
- Server-side authorization remains close to data access.
- Error states and blocked workflows are clear in the UI.
- Manual or automated regression coverage exists for the main workflows.

## M5 - Hosted Pilot Readiness

Goal: prepare for real hosted use with one or more pilot hotels.

Acceptance criteria:

- Clerk invitation and app membership provisioning are documented.
- Neon migration, seed, backup, and recovery workflows are documented.
- Vercel deployment, environment, and rollback steps are documented.
- Security review covers auth, tenant isolation, secrets, exports, backups, and audit logs.
- A pilot runbook exists for daily operations and support.
