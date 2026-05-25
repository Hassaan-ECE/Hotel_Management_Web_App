# Real Hotel Data Analysis for Better Test Coverage

Source data analyzed from `D:\Projects\data\Hotels` on May 25, 2026:

- `B&J Hotel and Apartments Pecos Tx - HousekeepingReport May 25, 2026.xlsx`
- `B&J Hotel and Apartments Pecos Tx - TransactionsReport May 25, 2026.xlsx`
- `B&J Hotels Roswell NM - HousekeepingReport May 25, 2026.xlsx`
- `B&J Hotels Roswell NM - TransactionsReport May 25, 2026.xlsx`

This report intentionally uses only aggregate operational patterns. Do not copy real guest names, card last-four values, reservation/account numbers, staff processor names, or free-text notes from the source exports into seed data, tests, screenshots, or fixtures.

## High-Value Findings

The current demo data is structurally smaller and cleaner than the real exports. The real hotels are not 13-room examples; they are 46 and 52-room properties with uneven room-type mixes, separate housekeeping condition and occupancy states, compound room numbers, stayovers, departing rooms, arrivals due, and payment activity that includes captures, declines, refunds, cash, and checks.

The most important modeling gap is that the app currently uses one `rooms.status` field for availability, occupancy, housekeeping, and maintenance. The housekeeping exports keep at least two separate concepts:

- `Condition`: examples include `Clean` and `Dirty`.
- `Occupancy`: examples include `Vacant`, `Occupied - Stayover`, and `Occupied - Departing`.

Keeping those concepts separate would make the app behave more like an actual front desk and housekeeping workflow.

## Housekeeping Snapshot

### Pecos, TX

- Total rooms: 52.
- Room classes: 42 Double Queen, 8 King, 2 Suites.
- Zones: 20 rooms on 1st Floor, 19 on 2nd Floor, 13 on 3rd Floor.
- Condition: 52 Clean.
- Occupancy: 24 Vacant, 25 Occupied - Stayover, 3 Occupied - Departing.
- Current-stay rooms: 28 rooms, 53.8% of inventory.
- Arrival-due rooms: 3 rooms, 5.8% of inventory.
- Compound room numbers: 2 examples, such as paired room-number formats.

### Roswell, NM

- Total rooms: 46.
- Room classes: 19 One Bed One Bath, 13 Two Bed Two Bath, 12 Studio Plus, 2 Studio.
- Zones: 46 rooms in Default Zone.
- Condition: 42 Clean, 4 Dirty.
- Occupancy: 27 Occupied - Stayover, 19 Vacant.
- Current-stay rooms: 27 rooms, 58.7% of inventory.
- Arrival-due rooms: 6 rooms, 13.0% of inventory.
- Compound room numbers: none observed in this export.

## Transaction Snapshot

Transaction details are daily logs for May 1 through May 25, 2026. The detail report includes declined transactions as negative rows, but the summary report's `Net Total ($)` excludes declined card attempts. For app metrics, revenue should exclude declines, while declines should remain visible as failed payment activity.

### Pecos, TX

- Summary net total excluding declines: $56,190.40.
- Payment mix: $44,369.53 credit card, $11,417.22 cash, $403.65 check.
- Detail rows: 348 payment events across 25 active days.
- Credit card events: 235 captures, 42 declines, 5 refunds.
- Gross positive detail activity: $58,805.51.
- Negative detail activity including declines and refunds: -$10,034.42.
- Positive transaction amount distribution: min $2.73, median $87.75, p75 $242.19, max $1,653.23.
- Daily transaction count: average 13.9, min 4, max 38.
- Time pattern: most payment activity appears from 3 PM through midnight.
- Repeat activity: 61 reservation/account identifiers had more than one payment event; the maximum observed was 13 events for one account.

### Roswell, NM

- Summary net total excluding declines: $80,869.40.
- Payment mix: $70,168.17 credit card, $10,270.34 check, $430.89 cash.
- Detail rows: 427 payment events across 25 active days.
- Credit card events: 332 captures, 33 declines, 5 refunds.
- Gross positive detail activity: $87,213.48.
- Negative detail activity including declines and refunds: -$19,648.52.
- Positive transaction amount distribution: min $20.00, median $103.78, p75 $219.96, max $3,123.90.
- Daily transaction count: average 17.1, min 7, max 27.
- Time pattern: most payment activity appears from 3 PM through midnight.
- Repeat activity: 50 reservation/account identifiers had more than one payment event; the maximum observed was 9 events for one account.

## App Gaps Exposed by the Data

1. Room inventory is too small. Current seed data has 13 rooms per demo hotel, while these properties have 46 and 52 rooms.
2. Room mix is too generic. Real examples include apartment-style categories such as One Bed One Bath, Two Bed Two Bath, Studio, and Studio Plus.
3. `rooms.status` is overloaded. Real operations separate occupancy from housekeeping condition.
4. Housekeeping should care about stayovers, departing rooms, vacant rooms, and arrivals due, not just a generic dirty/ready queue.
5. Revenue is currently derived from reservations. The exports show separate payment events, including declines and refunds, that should not be collapsed into reservation totals.
6. The app does not currently model payment method mix, card transaction type, refunds, declines, split tender, or repeated payment attempts.
7. Search and exports should be tested with unusual room-number formats, including compound room numbers.
8. The two hotels should not share identical operational patterns. Pecos has a cash-heavy mix relative to Roswell; Roswell has more check volume and apartment-style room classes.
9. Hotel timezone defaults should be reviewed. Pecos is plausibly Central time; Roswell should likely use Mountain time if modeled as an actual New Mexico property.

## Recommended Test Data Shape

Use anonymized synthetic guest and staff names, but match the real aggregate shapes:

- Create two demo hotels with 52 and 46 rooms.
- Preserve realistic room class distributions and floor/zone distributions.
- Include room numbers that mirror real formatting patterns, including compound room numbers for one property.
- Seed occupancy separately from housekeeping condition:
  - vacant clean rooms
  - vacant dirty rooms
  - occupied stayovers
  - occupied departures
  - arrival-due rooms
  - maintenance-blocked rooms
- Seed reservations so the daily dashboard has:
  - 25 to 30 in-house rooms per hotel
  - 3 to 6 arrivals due
  - 0 to 4 dirty rooms depending on property
  - confirmed, checked-in, checked-out, pending, cancelled, and no-show-like cases if a no-show status is added
- Seed payment activity, either in a new payments table or in a demo-only fixture, with:
  - captures
  - declines
  - refunds
  - cash
  - checks
  - multiple attempts on the same reservation
  - evening-heavy payment timing
  - revenue metrics that exclude declines

## Suggested Schema Direction

If the app is going to support realistic operations, consider adding durable fields or tables rather than encoding everything into `rooms.status`:

- `rooms.housekeeping_condition`: `clean`, `dirty`, `cleaning`, `inspection`, `blocked`.
- `rooms.occupancy_state`: `vacant`, `occupied_stayover`, `occupied_departing`, `arrival_due`.
- `payment_transactions`: hotel, reservation, processed time, method, card network, card method, transaction type, amount, status, synthetic last4, audit actor.

Alternatively, occupancy can be derived from reservations and dates, but housekeeping condition should still be separate from occupancy and maintenance state.

## Recommended Acceptance Criteria for the Next Implementation Pass

- Demo/seed data creates two realistic hotel inventories with 46 and 52 rooms.
- Manager dashboard occupancy roughly matches the real snapshot range of 54% to 59%.
- Housekeeping views show stayover, departing, arrival-due, dirty, clean, blocked, and inspection contexts without exposing guest PII to housekeeping roles.
- Payment metrics distinguish revenue, refunds, declines, cash, checks, and credit cards.
- Revenue totals exclude declined payment attempts.
- Search handles compound room numbers and room classes with apartment-style names.
- Hotel data remains isolated by `hotel_id`.
- Tests or validation cover the two-property setup and the revenue/decline distinction.

