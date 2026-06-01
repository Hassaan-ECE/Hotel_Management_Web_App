# Agent Workflow

Last updated: 2026-06-01

## Default Operating Model

The manager owns the final result, with strongest-reasoning validation for planning, architecture, security, performance, QA, and final review.

Use delegation only when it is explicitly requested, supported by the runtime, and useful for a bounded task.

For this project, the preferred pattern is:

1. Manager defines objective, acceptance criteria, affected files, risks, and validation.
2. GPT-5.3-Codex-Spark handles bounded implementation or read-only scouting tasks with a clear file ownership scope.
3. Manager reviews the patch against `AGENTS.md`, project-management docs, security/isolation rules, and validation results.
4. Spark or manager fixes review findings.
5. Manager records validation and reports the outcome.

## When To Use GPT-5.3-Codex-Spark

Good Spark tasks:

- Implementing a narrow API route or service change.
- Adding focused tests after the acceptance criteria are written.
- Refactoring a small, well-owned component.
- Reading a specific subsystem and returning a concise report.
- Updating docs from a clear outline.

Avoid Spark delegation for:

- Ambiguous product decisions.
- Cross-cutting architecture without a manager-authored plan.
- Security-sensitive changes without explicit review criteria.
- Work that overlaps with another agent's file ownership.

## Implementation Packet Template

Use this structure when assigning work:

```text
Objective:

Context:

Files you own:

Files you may read:

Acceptance criteria:

Constraints:
- Follow AGENTS.md.
- Use Bun commands.
- Preserve unrelated user changes.
- Keep hotel data isolated by hotel_id.
- Keep auth and authorization server-side and close to data access.
- Do not initialize database or service clients at module scope.

Validation to run:

Final response required:
- Files changed.
- Validation run and results.
- Known caveats.
```

## Manager Review Checklist

- Requirement match: does the patch solve the assigned problem and no more?
- Tenant isolation: does every hotel data path filter by `hotel_id`?
- Authz: are server-side role checks present before data access?
- Data modeling: are operational concepts represented clearly instead of overloaded?
- Security: no secrets, unsafe shell patterns, or PII leakage.
- Tests/validation: commands were actually run and results are recorded.
- Scope control: no unrelated cleanup, formatting churn, or generated-state edits.
