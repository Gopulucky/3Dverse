# Print Partner Hub — profile, availability, matching, inbox

Status: draft for review · 2026-11-11 · Sub-project 3 of 3

## Goal

Someone who owns 3D printers can set up, in one place, **what they can print, for how much, how fast, and whether they're taking work**. Creators then see only partners who are accepting work and can filter by technology and material. Incoming collaboration requests land in one **inbox** with clear next actions (accept, decline, quote). No payouts in this piece.

## What exists today (findings)

- `print_partners` holds `name`, `region`, `cost_tier` and counters. It is auto-created for a logged-in `print_partner` user (`services/partner_identity.py`). `print_partner_capabilities` (technology + material, one row each) exists but **nothing in the UI writes it**.
- `/partner/settings` edits user fields only (contact, shop name, GST, pincode, coordinates, prints per week).
- `GET /api/collaboration/partners` (creator side) returns **every** partner. There is no availability check and no lead time, rates or build volume.
- Ticket workflow: `pending_payment → paid → design_submitted → (sample_printing) → certified → negotiating → agreed`, plus `rejected` / `expired`. The partner can **decline** and **certify** (the quote: costs, print time, suggested price, sample photo). **No endpoint moves a ticket to `sample_printing`**, so a partner can't "accept" a job.
- The partner hub's Tickets tab lists only pending tickets, with raw status codes.
- Migration head `d9f2a7b6c104`, which is also the live database's revision.

## Design

### 1. Partner profile (data)
Additive Alembic migration on `print_partners`. All columns are nullable or defaulted, so existing rows stay valid:

| Column | Type | Meaning |
|---|---|---|
| `accepting_work` | bool, default false | the "Accepting work / Paused" switch |
| `bio` | text, max 600 chars | short description shown to creators |
| `lead_time_days` | int 1–60 | typical days from accepted job to dispatch |
| `price_per_gram_inr` | numeric ≥ 0 | headline material rate |
| `min_order_inr` | numeric ≥ 0 | smallest job they take |
| `build_x_mm`, `build_y_mm`, `build_z_mm` | int 50–2000 | largest single print |

Capabilities stay in `print_partner_capabilities`. Technologies come from the existing `PrinterTechnology` enum, and materials are free text from a suggested list (PLA, PETG, ABS, TPU, Resin, Nylon…).

**Rule:** `accepting_work` can only be switched **on** when the profile is complete: at least one capability, a lead time, a price per gram and a build volume. Otherwise the API answers 400 with what's missing.

### 2. Partner API (partner role only, via `require_partner_record`)
- `GET /api/partner/profile`: profile, capabilities and a `missing` list (what blocks "accepting work").
- `PUT /api/partner/profile`: name, region, bio, lead time, rates, build volume. Validated ranges; unknown fields rejected.
- `PUT /api/partner/capabilities`: replaces the list `[{technology, material}]`. De-duplicated, at most 30 entries, and the technology must be a valid enum value.
- `PATCH /api/partner/availability` `{accepting_work}`: enforces the completeness rule when turning on.
- `POST /api/collaboration/tickets/{id}/accept`: partner only, `design_submitted → sample_printing`. Any other state is 400, and a ticket not owned by this partner is 404.

Validation and the completeness rule live in a pure module, `services/partner_profile.py`, unit-tested without a database (the existing suite needs no DB).

### 3. Matching (creator side)
`GET /api/collaboration/partners` returns **only partners with `accepting_work = true`**, and adds `bio`, `lead_time_days`, `price_per_gram_inr`, `min_order_inr` and the build volume. The existing filters (`region`, `technology`, `material_type`) stay, plus an optional `min_build_mm` (the smallest of the partner's three build dimensions must be at least this). Creating a ticket for a partner who is paused is refused with 409.

`/collaboration` (creator page): each partner card shows lead time, price per gram, minimum order and build volume. It gets technology and material filter controls, and an honest empty state ("No print partners are taking work right now") when nobody is accepting.

### 4. Partner hub (UI)
- **Header:** an **Accepting work / Paused** switch. If the profile is incomplete, the switch stays off and a link reads "Finish your profile to accept work", listing what's missing.
- **New "Profile" tab** in the hub:
  - capabilities as removable chips with an "Add" control (technology select + material input with suggestions)
  - build volume (three mm fields)
  - price per gram and minimum order (INR)
  - lead time (days)
  - bio

  It saves with one button. The existing `/partner/settings` keeps account details (contact, GST, password).
- **Tickets tab becomes "Inbox"**, with three filters:
  - **Needs action:** `paid` (waiting for the creator's design, shown as "Waiting for design"), `design_submitted` (**Accept** / **Decline**), `sample_printing` (**Send quote**, which opens the existing certification form on the ticket page)
  - **In progress:** `certified`, `negotiating`
  - **Closed:** `agreed`, `rejected`, `expired`

  Each row shows the product reference, the creator, how long ago it arrived, a human-readable status label, and the next action. Labels come from one shared map, as with order statuses.
- Phone: the tabs, switch and inbox stack in one column; buttons are 44 px tall.

## Non-goals
- Payouts, earnings, invoicing, and automatic routing of marketplace orders to partners.
- Partner sign-up flow (partner access is still granted by an admin), public partner profile pages, and ratings.
- Changing order fulfilment (the Jobs tab is unchanged).

## Testing and verification
- **Backend (pytest, no DB):**
  - profile validation (ranges, unknown fields)
  - the completeness rule and its `missing` list
  - capability de-duplication and limit
  - the ticket-accept state rule (only `design_submitted`, owner only)
  - matching filters (paused partners excluded, `min_build_mm`), as pure functions over plain objects
  - The route handlers are thin wrappers around these.
- **Frontend smoke** (`partner-smoke.mjs` and a creator-side check), with fixtures:
  - switch blocked with the missing list, then allowed after the profile is saved
  - capability add and remove
  - inbox filters and an Accept call
  - creator list hides paused partners and shows lead time and rates
  - phone width without overflow
- **Build, lint, typecheck, full backend and frontend suites.**
- **Migration:** reviewed and run on a scratch upgrade check (`alembic upgrade head --sql` output read). **Applying it to the live database is your step, after a backup.** Render doesn't run migrations automatically unless its start command does; I'll check `render.yaml` and say exactly what to run.

## Risks
| Risk | Mitigation |
|---|---|
| Migration on the live database | Additive only, nullable or defaulted columns, no data rewrite; backup first |
| Creators suddenly see no partners | Correct while nobody has opted in; the empty state explains it; the admin can give a partner role and the partner switches on |
| Ticket states drift between backend and frontend | One label map plus a test comparing it with the `TicketStatus` enum, like the order-status drift test |
