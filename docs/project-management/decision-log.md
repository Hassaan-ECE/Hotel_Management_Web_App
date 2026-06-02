# Decision Log

Last updated: 2026-06-02

## Decisions

### 2026-06-01 - Use `docs/project-management/` As The PM Source Of Truth

Decision:

Keep structured project coordination files under `docs/project-management/`.

Rationale:

- The repo already uses `docs/` for durable project documentation.
- PM files should be versioned with the application source.
- This avoids treating chat memory, caches, or generated artifacts as canonical.

### 2026-06-01 - Manager-Led Specialist Workflow

Decision:

Use a manager-led workflow. The manager owns scope, plans, integration, skeptical review, validation, and final reporting. Use GPT-5.3-Codex-Spark agents for bounded implementation or scouting tasks when delegation is explicitly useful. Planning and final review should use the strongest available reasoning model.

Rationale:

- This matches the repo `AGENTS.md`.
- Spark has a separate usage limit and is suitable for fast, scoped coding tasks.
- The manager still needs to check work before accepting it.
- Planning and review are higher-leverage risk points than bounded implementation, especially for auth, tenant isolation, and hosted environment decisions.

### 2026-06-01 - Disable Demo Fallback In Staging And Production

Decision:

Staging and production must set `HOTEL_APP_DEMO_MODE="false"` and provide dedicated Clerk and Neon resources. Demo-only previews remain acceptable only when they are intentionally separate from pilot/staging/production data.

Rationale:

- Hosted pilot environments should fail visibly when Clerk or Neon configuration is incomplete instead of silently using in-memory demo data.
- This keeps staging behavior closer to production.
- Demo-only previews are still useful for branch review as long as they are clearly labeled and isolated.

### 2026-06-01 - Finish Release Foundation Before Schema Expansion

Decision:

Complete clean-clone verification, real hosted migration/seed validation, font-build reliability, and production membership provisioning before starting the room-state schema split.

Rationale:

- Packets 1 through 5 reduced the immediate P0 data-isolation, input, workflow, testing, and setup risks.
- The room-state split is higher blast radius and should start only after setup and release gates are repeatable.
- Hosted validation may reveal environment or seed issues that should not be mixed into schema migration work.

### 2026-06-01 - Treat Realistic Fixture Work As Active But Not Complete

Decision:

Use the existing realistic fixture docs and files as the active direction for demo realism, but do not consider the data-model work complete until the schema supports separated room states and payments.

Rationale:

- Existing docs already identify the key operational gaps.
- The fixture contains concepts the durable schema cannot yet persist.

### 2026-06-01 - Use System-Local Fonts For Deterministic Builds

Decision:

Remove remote Google font loading and use system-local font stacks for the hosted app.

Rationale:

- Production and CI builds should not depend on live Google font fetching.
- The typography change is minor compared with the release reliability gain.
- Exact Geist matching can be revisited later with licensed committed font files if design polish requires it.

### 2026-06-01 - Use Manual Clerk And Neon Provisioning For Pilot

Decision:

Use Clerk invitations for identity and reviewed manual Neon SQL for app hotel memberships and staff rows during the pilot.

Rationale:

- The app currently treats `hotel_memberships` as the source of truth for hotel access and roles.
- There is no admin UI or dedicated provisioning command yet.
- A concrete runbook is safer than ad hoc SQL while staging resources and pilot access are still limited.

### 2026-06-02 - Use Gated Admin Role Preview For One-Account QA

Decision:

Add a feature-flagged, Clerk-user allow-listed Admin role preview that changes the effective server role for the active hotel without changing persisted `hotel_memberships` rows.

Rationale:

- The user needs to smoke test manager, front desk, housekeeping supervisor, housekeeper, and maintenance flows from one Clerk account.
- The app database remains the source of truth for hotel roles; Clerk public metadata is not used for hotel authorization.
- A broad production debug role-switcher would be too risky, so preview is real Admin-only, default off, allow-listed, hotel-scoped, short-lived, and covered by tests.

## Open Questions

- What is the first pilot deployment target: demo-only hosted preview, Clerk/Neon staging, or real hotel pilot?
- Should payment support be built before or after the room-state schema split?
- Which browser-level role smoke checks should be automated first, if any?
- When should manual pilot provisioning be replaced with an admin UI or reviewed provisioning script?
