# Project Brief

Last updated: 2026-06-01

## Product

The hosted hotel management web app is a Next.js/Vercel version of the desktop hotel management MVP. It is intended to support multi-hotel ownership, role-based hotel operations, and durable hosted data through Clerk, Neon Postgres, and Drizzle.

This project is separate from `D:\Projects\Active\Hotel_Management_App`; that desktop app is a reference only unless explicitly requested.

## Primary Users

- Owner: sees a portfolio across hotels and high-level operating metrics.
- Manager: oversees daily operations, reservations, housekeeping, maintenance, reports, and audit activity for one hotel.
- Front desk: searches records, creates guest records, handles walk-ins, and updates reservation status.
- Housekeeping supervisor: assigns rooms, approves or sends back completed room work, and reviews issue reports.
- Housekeeper: works an assigned room queue, starts and finishes cleaning, and reports room issues.
- Maintenance: manages maintenance tickets and status transitions.

## Current Stack

- Next.js App Router on Vercel.
- React 19, TypeScript, Tailwind CSS.
- Bun package manager.
- Clerk for identity.
- App database memberships for hotel-level role authorization.
- Neon Postgres with Drizzle schema and migrations.
- Demo mode with fake login and in-memory realistic hotel fixtures when Clerk or Neon are not configured.
- Deterministic system-local font stacks; production builds do not fetch Google font assets.

## Current Product Surface

Implemented or scaffolded workflows:

- Demo login with owner and employee access codes.
- Invite-only Clerk sign-in that sends authenticated users to the portfolio and keeps public sign-up disabled.
- Owner portfolio across two realistic demo hotels.
- No-access portfolio state for signed-in users who have not yet been provisioned into a hotel.
- Hotel workspace route with role-filtered views.
- Front desk search, guest creation, walk-in reservations, and reservation status updates.
- Room status updates.
- Housekeeping task assignment, start, finish, approval, and send-back.
- Housekeeper room issue reports with supervisor approval or cancellation.
- Maintenance ticket creation and updates.
- Manager dashboard metrics and lists.
- CSV exports for rooms, reservations, and maintenance.
- JSON backup export.
- Server-side role and hotel membership checks on API routes.
- Audit log inserts for key mutations.
- Bun test suite covering focused tenant isolation, input validation, service workflows, and representative API authorization paths.
- Strict workflow guards for reservation, housekeeping, and maintenance status transitions in production and demo mode.
- Manual pilot runbook for Clerk invitations, app memberships, role changes, staff rows, and deactivation.

## Important Current Constraints

- The durable schema still uses one `rooms.status` field for availability, occupancy, housekeeping condition, and maintenance state.
- Realistic fixture data has separate `housekeepingCondition`, `occupancyState`, and payment event concepts, but the durable schema cannot persist those separately yet.
- Payment exports exist in fixture data but are not stored in the database and are not yet a first-class app surface.
- The automated test suite is still focused; broader role smoke coverage and future payment/revenue tests remain needed.
- Production auth provisioning is documented for manual pilot operations, but there is no admin UI or dedicated provisioning script yet.

## Shipping Definition

The project is shippable when:

- Auth, role membership, and hotel isolation work reliably in hosted mode.
- Core role workflows are validated against realistic two-hotel data.
- Data modeling supports real hotel operations without overloading critical states.
- Revenue/payment reporting does not count failed or declined payments as revenue.
- Deployment, environment setup, seed/migration, and rollback steps are documented and repeatable.
- There is enough automated and manual validation to protect the pilot workflows.
