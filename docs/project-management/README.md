# Project Management Hub

Last updated: 2026-06-01

This folder is the durable coordination layer for shipping the hosted hotel management web app. Keep planning, decisions, risks, validation, and implementation handoffs here so future work does not depend on chat memory.

## Files

- `project-brief.md` - what the product is, who it serves, and what exists today.
- `hosted-environment-setup.md` - environment, hosting, seeding, and mode behavior runbook.
- `production-auth-provisioning.md` - Clerk invite and app membership provisioning runbook.
- `roadmap.md` - milestone sequence from current prototype to shippable hosted app.
- `backlog.md` - prioritized work items with acceptance criteria.
- `risk-register.md` - product, technical, security, data, and delivery risks.
- `validation-log.md` - checks actually run, results, and known caveats.
- `decision-log.md` - dated decisions and open questions.
- `agent-workflow.md` - how to use manager-led planning plus GPT-5.3-Codex-Spark implementation agents.
- `active-sprint.md` - immediate working plan and next implementation packets.
- `testing.md` - official test command, coverage expectations, and mock patterns.
- `release-checklist.md` - release gate commands and manual smoke checks.

## Operating Rules

1. Update the relevant file before or during meaningful project changes.
2. Keep entries specific enough to drive implementation and review.
3. Do not mark work complete unless the acceptance criteria are met and validation is recorded.
4. Use the repo's `AGENTS.md` as the implementation contract.
5. Preserve existing product docs in `docs/`; this folder coordinates delivery, not domain research.
