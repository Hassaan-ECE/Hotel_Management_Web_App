# Minimal Hospitality Design Reference

## Purpose

This file is the canonical design decision record for the hosted hotel management web app. Use it whenever future work needs to check the intended visual direction, role structure, or tradeoffs.

The final design direction is **minimal hospitality operations**: calm, role-focused, low-clutter, and color-theory based. The product should feel like a fast hotel operations tool, not a marketing site.

`D:\Projects\Active\Hotel_Management_App` is the product-structure reference because its Rust/Tauri app intentionally separates workflows by role. `https://hardwareoperations.com/` is the current typography and color reference only; do not copy its marketing layout, custom cursor, motion system, product reel, or scroll-heavy presentation into the operational app.

## Visual System

- Canvas: warm grey from Hardware Operations (`rgb(228, 226, 222)`) to reduce glare while keeping the app quiet.
- Surfaces: warm grey raised panels with restrained black-alpha rules, not pure white cards.
- Brand ink: near-black (`#0e0e0e`) for headings, the mark, and high-level structure.
- Primary action: the Hardware Operations orange accent (`oklch(0.68 0.22 42)`) for the main workflow action and focus states.
- Status: keep semantic green, amber, red, and neutral states, derived from the Hardware Operations status-dot palette where practical.
- Typography: `Geist Mono` for bundled interface text. Use the `GT Pressura Extended` display stack for headings/brand text only when a licensed local copy is available. Avoid oversized editorial headings in forms, tables, room boards, and staff task lists.
- Layout: calm cards, dense but readable grids, clear section grouping, and no decorative motion in operational screens.

## Role Principle

Each role should see only the work it needs. This is not just visual preference; it is the core usability and least-privilege rule.

- Owner/manager: KPIs, exports, backup, operational queues, revenue, audit-oriented context, and issue review.
- Front desk: search, arrivals, in-house guests, check-in/out, walk-ins, guest records, and room readiness context.
- Housekeeping supervisor: room assignment, inspection, send-back, team workload, and pending issue review.
- Housekeeping staff: actionable assigned/cleaning room work only, with start, finish, and report issue actions. Demo code `31` should mirror the Rust/Tauri Ava flow: a focused progress strip, current assigned room first, next rooms second, state-specific actions, and issue reporting only after the staff member chooses `Report Issue`.
- Maintenance: ticket creation, open maintenance queue, priority/status context, and room maintenance context.

Do not show revenue, exports, backup, guest search, room-admin controls, or manager queues to staff who do not need them.

## Design Characteristics To Borrow

- From the Rust/Tauri app: role-specific workflows, compact dashboard scale, calm hospitality palette, and low-friction operational controls.
- From `hardwareoperations.com`: warm grey/black/orange palette, mono interface tone, and restrained rule-based hierarchy only.
- From the hosted app requirements: multi-hotel portfolio support, hotel data isolation, and hosted SaaS navigation.

## Design Characteristics To Avoid

- No black editorial hero blocks in the operations app.
- No industrial product asset as a login or portfolio centerpiece.
- No grid-heavy decorative background.
- No bright cobalt-dominant palette.
- No custom cursor, reel/video hero, or motion-dependent presentation copied from Hardware Operations.
- No oversized marketing typography for dashboard headings.
- No scroll-heavy interactions, decorative motion, or animation-dependent state changes.
- No all-in-one workspace that forces every role to scan unrelated controls.

## Implementation Direction

- Treat this file as the source of truth before making visual changes.
- Keep CSS tokens explicit and reusable: canvas, surface, ink, primary, accent, success, warning, danger, border, radius, and shadow.
- Keep login compact: brand, one access-code input, one primary button, small code hints, and a prototype note.
- Keep the staff login hints aligned with the Rust/Tauri prototype: `1 Manager`, `2 Front desk`, `3 HK supervisor`, `31 Ava`, `32 Ben`, `33 Mia`, `34 Noah`, and `4 Maintenance`. Hosted-only owner access can exist, but it should not replace or merge the staff hints.
- Keep portfolio quiet: owner overview, totals, and hotel cards without a marketing hero.
- Keep hotel workspaces role-focused and dense enough for repeated use.
- Prefer static CSS and React structure over animation libraries.
- Do not change public routes, APIs, database schema, auth, or authorization behavior just for visual work.

## Acceptance Criteria

- The app reads as one coherent minimal hospitality operations product.
- The design is calm, role-specific, and easy to scan.
- Each demo role lands on a focused surface with only relevant workflows.
- Forms, tables, status pills, and action buttons remain compact and legible on desktop and mobile.
- Color use follows the palette rules above and status colors remain semantic.
- `Simple_Website_Design` does not visually dominate the app.
