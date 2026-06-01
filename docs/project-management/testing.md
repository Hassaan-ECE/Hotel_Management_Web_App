# Testing Guide

Last updated: 2026-06-01

## Command

Run the project test suite with:

```powershell
bun run test
```

The test script uses Bun's built-in test runner with per-file isolation. Keep isolation enabled because several tests use module mocks for server-only, auth, database, route, and page modules.

## What To Test

Add service tests when a change affects domain behavior, data isolation, or state transitions in `src/lib/hotel-service.ts`.

Add route tests when a change affects API authorization, request parsing, route parameters, or whether a route calls the expected service function.

Every new hotel-scoped read or mutation should have coverage for:

- Same-hotel success.
- Cross-hotel or missing-resource denial.
- Role denial when exposed through an API route.
- The important state transition or output shape.

## Test Mocks

Server-side modules often need these Bun mocks:

```ts
mock.module("server-only", () => ({}));
mock.module("@/lib/authz", () => ({ isDemoMode: () => false }));
mock.module("@/lib/db", () => ({ getSql: () => mockDb.sql }));
```

Route tests should mock `requireHotelSession` and the service function imported by the route. Service tests should mock `getSql` with an in-memory SQL adapter that asserts `hotel_id` filtering and relevant state changes.

Keep mocks focused on the SQL or route behavior under test. Do not weaken production code to make tests easier.
