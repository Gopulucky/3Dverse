# Print Partner Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A printer owner can set capabilities, rates, lead time and build volume, switch "Accepting work" on or off, and work incoming collaboration requests from one inbox; creators see only partners who are accepting work.

**Architecture:** Pure rules (validation, completeness, matching, ticket-accept state) live in `backend/app/services/partner_profile.py` and are unit-tested without a database. Thin route handlers call them. One additive Alembic migration adds columns to `print_partners`. The frontend gets a Profile tab, an availability switch, an Inbox, and richer creator-side partner cards, with ticket labels from one shared map.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (head `d9f2a7b6c104`), pytest; Next 16 / React 19, TanStack Query, `node:test` + `scripts/load-ts.mjs`, Playwright smoke.

**Spec:** `docs/superpowers/specs/2026-11-11-partner-hub-design.md`

## Global Constraints

- Migration is **additive only**: new nullable or defaulted columns on `print_partners`, `down_revision = "d9f2a7b6c104"`, a working `downgrade()`. **Never run it against the live database**; the user does that after a backup.
- No payouts, partner sign-up, public partner pages, order-routing or Jobs-tab changes.
- Ranges (exact): `lead_time_days` 1–60; `price_per_gram_inr` ≥ 0 and ≤ 100000; `min_order_inr` ≥ 0 and ≤ 10000000; each `build_*_mm` 50–2000; `bio` ≤ 600 chars; at most 30 capabilities.
- `accepting_work` may be switched on only when: ≥1 capability, `lead_time_days`, `price_per_gram_inr` and all three build dimensions are set. The API answers 400 with a `missing` list otherwise.
- Existing behaviour stays: ticket workflow, decline reason rule, certify endpoint, creator-type rules (sellers cannot use partners).
- Frontend copy: sentence case, no "please", human status labels from one map. Existing smoke names stay unless a task changes them.
- No commits unless the user asks. Do not touch `frontend/AGENTS.md`, `docs/brand/*`, `.hallmark/*`, `sample_images/`.

## Review Focus

1. **Turning on "accepting work" through the API with an incomplete profile** must be refused with the list of what's missing. Test: Task 1 `test_cannot_accept_work_when_incomplete`.
2. **Creating a ticket for a paused partner** must be refused (409). Test: Task 3 `test_ticket_for_paused_partner_is_refused`.
3. **Capabilities that differ only by case or spacing** ("pla", " PLA ") must collapse to one entry; unknown technologies must be rejected. Test: Task 1 `test_capabilities_are_normalised`.
4. **Accepting a ticket that belongs to another partner** must look like "not found"; **accepting from the wrong state** must be 400. Test: Task 1 `test_accept_rules`, Task 3 route test.
5. **Out-of-range numbers** (negative price, 0 or 99999 mm build, 0 or 61 lead days). Test: Task 1 `test_profile_ranges`.

---

### Task 1: Pure rules

**Files:** Create `backend/app/services/partner_profile.py`, `backend/tests/test_partner_profile.py`.

**Interfaces — Produces:**
- `class ProfileError(ValueError)`: `.problems: list[str]`
- `REQUIRED_FOR_WORK = ("capabilities", "lead_time_days", "price_per_gram_inr", "build_volume")`
- `validate_profile(data: dict) -> dict` — returns only known keys (`name, region, bio, lead_time_days, price_per_gram_inr, min_order_inr, build_x_mm, build_y_mm, build_z_mm`) with the ranges above; unknown keys or out-of-range values raise `ProfileError` listing every problem; strings are stripped.
- `normalise_capabilities(items: list[dict], valid_technologies: set[str]) -> list[dict]` — items `{"technology", "material"}`; lower-case technology, material stripped and case-folded for comparison but kept in its first-seen spelling; duplicates removed; >30 or unknown technology or empty material raises `ProfileError`.
- `missing_for_work(profile, capabilities) -> list[str]` — names from `REQUIRED_FOR_WORK` still missing (`profile` is any object with the profile attributes).
- `can_accept_work(profile, capabilities) -> None` — raises `ProfileError` with `.problems` = the missing list.
- `filter_partners(partners, *, technology=None, material=None, min_build_mm=None) -> list` — keeps only `accepting_work` partners; `partners` are objects with `.accepting_work`, `.capabilities` (list of dicts), `.build_x_mm/.build_y_mm/.build_z_mm`.
- `ACCEPTABLE_FROM = "design_submitted"`, `accept_target(status: str) -> str` — returns `"sample_printing"` for `design_submitted`, else raises `ProfileError`.

- [ ] **Step 1: Failing tests** (`test_partner_profile.py`): `test_profile_ranges` (each bound: 0 and 61 days, -1 price, 49 and 2001 mm, 601-char bio, unknown key all raise with a problem naming the field; valid minimal dict passes and strips whitespace); `test_capabilities_are_normalised` (`[{"technology":"FDM","material":"PLA"},{"technology":"fdm","material":" pla "}]` → one entry; unknown technology `"laser"`, empty material, 31 items raise); `test_cannot_accept_work_when_incomplete` (empty profile → problems == all four names; complete profile and ≥1 capability → no error; each single missing piece reported alone); `test_filter_partners` (paused excluded; technology and material filter; `min_build_mm=200` uses the smallest dimension; partner with no build volume excluded when `min_build_mm` given); `test_accept_rules` (`design_submitted` → `sample_printing`; each of `pending_payment, paid, sample_printing, certified, negotiating, agreed, rejected, expired` raises).
- [ ] **Step 2:** `cd backend && python -m pytest tests/test_partner_profile.py -q -p no:cacheprovider` → FAIL (module missing).
- [ ] **Step 3:** Implement the module to the signatures above.
- [ ] **Step 4:** Tests PASS; full backend suite still green.

### Task 2: Columns and migration

**Files:** Modify `backend/app/models/print_partner.py`; Create `backend/alembic/versions/<rev>_partner_profile_fields.py`, `backend/tests/test_partner_migration.py`.

**Interfaces — Produces:** `PrintPartner` columns `accepting_work` (Boolean, default False, server_default false, not null), `bio` (String, nullable), `lead_time_days` (Integer, nullable), `price_per_gram_inr` (Float, nullable), `min_order_inr` (Float, nullable), `build_x_mm`, `build_y_mm`, `build_z_mm` (Integer, nullable).

- [ ] **Step 1: Failing tests:** `test_model_has_profile_columns` (all nine names exist on `PrintPartner.__table__`, `accepting_work` default False); `test_migration_chain_has_one_head_after_d9f2a7b6c104` (use `alembic.script.ScriptDirectory.from_config(Config("alembic.ini"))`: exactly one head, it is the new revision, its `down_revision == "d9f2a7b6c104"`); `test_migration_is_additive` (read the migration source: contains `add_column` for each of the nine columns and `drop_column` for each in `downgrade`; contains no `drop_table`/`alter_column`/`execute(`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add columns; write the migration (`revision` a new 12-hex id, `op.add_column` ×9, symmetrical `downgrade`). `accepting_work` uses `server_default=sa.false()`.
- [ ] **Step 4:** Tests PASS. Run `python -m alembic upgrade d9f2a7b6c104:head --sql` and read the output: only `ALTER TABLE print_partners ADD COLUMN` lines plus the version bump.

### Task 3: Partner and matching endpoints

**Files:** Modify `backend/app/api/routers/partner.py` (profile, capabilities, availability), `backend/app/api/routers/collaboration.py` (partners list, ticket creation, accept); Create `backend/tests/test_partner_routes.py`.

**Interfaces — Consumes:** Task 1 functions; Task 2 columns; `partner_identity.require_partner_record`; `PrinterTechnology`. **Produces:** `GET /api/partner/profile` → `{profile fields…, accepting_work, capabilities:[{technology,material}], missing:[…]}`; `PUT /api/partner/profile`; `PUT /api/partner/capabilities` body `{items:[{technology,material}]}`; `PATCH /api/partner/availability` body `{accepting_work: bool}`; `POST /api/collaboration/tickets/{id}/accept`; `GET /api/collaboration/partners` returns only accepting partners with `bio, lead_time_days, price_per_gram_inr, min_order_inr, build_x_mm, build_y_mm, build_z_mm`, plus optional query `min_build_mm`.

- [ ] **Step 1: Failing tests** (`test_partner_routes.py`) using FastAPI `TestClient` with `app.dependency_overrides` for `get_db` (in-memory SQLite engine, `Base.metadata.create_all(tables=[…users, print_partners, print_partner_capabilities, collaboration_tickets…])`) and `get_current_active_user`. If SQLite cannot host these tables, call the handler functions directly with a session fake and record a ruling. Tests: `test_profile_round_trip_and_missing_list`; `test_availability_blocked_then_allowed` (400 with `missing`, then 200 after profile + capabilities saved); `test_capabilities_replace_and_dedupe`; `test_partners_list_hides_paused_and_adds_rates`; `test_ticket_for_paused_partner_is_refused` (409); `test_accept_ticket_moves_to_sample_printing`; `test_accept_other_partners_ticket_is_404`; `test_accept_wrong_state_is_400`; `test_non_partner_cannot_use_partner_profile` (403).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement routes as thin wrappers over Task 1. Creator-side list keeps its existing role/creator-type checks.
- [ ] **Step 4:** Tests PASS; full backend suite green.

### Task 4: Ticket labels (shared map)

**Files:** Create `frontend/src/lib/ticket-lifecycle.ts`, `frontend/scripts/machines/ticket-lifecycle.test.mjs`; Modify `frontend/src/app/partner/page.tsx` (replace its local tone map).

**Interfaces — Produces:** `TICKET_LABEL: Record<string,string>` (pending_payment "Awaiting payment", paid "Waiting for design", design_submitted "Design received", sample_printing "Printing sample", certified "Quote sent", negotiating "Negotiating", agreed "Agreed", rejected "Declined", expired "Expired"); `ticketTone(status): "success"|"warning"|"in-progress"|"neutral"`; `type InboxGroup = "action"|"progress"|"closed"`; `inboxGroup(status): InboxGroup` (action: paid, design_submitted, sample_printing; progress: certified, negotiating; closed: agreed, rejected, expired; pending_payment → closed-excluded: returns `"hidden"`); `nextAction(status): "wait"|"accept"|"quote"|null`.

- [ ] **Step 1: Failing tests:** every `TicketStatus` value parsed from `backend/app/models/collaboration.py` has a label and a group (drift test, like `order-lifecycle.test.mjs`); table tests for `inboxGroup`, `nextAction`, `ticketTone`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm run test:unit` PASS.

### Task 5: Partner hub UI

**Files:** Create `frontend/src/components/partner/profile-tab.tsx`, `frontend/src/components/partner/inbox.tsx`, `frontend/src/components/partner/availability-switch.tsx`; Modify `frontend/src/app/partner/page.tsx`; Modify `frontend/scripts/partner-smoke.mjs`.

**Interfaces — Consumes:** Task 3 endpoints, Task 4 helpers.

- [ ] **Step 1: Failing smoke assertions** (partner-smoke fixtures for `/api/partner/profile`, `/capabilities`, `/availability`, tickets): switch is off and a "Finish your profile" message lists missing items; after saving profile + one capability the switch can be turned on and sends `PATCH availability {accepting_work:true}`; capability add/remove chips; Inbox tabs "Needs action", "In progress", "Closed" with correct counts; a `design_submitted` row shows **Accept** and **Decline**, Accept posts to `/tickets/{id}/accept`; a `sample_printing` row shows **Send quote** linking to `/collaboration/{id}`; status text uses labels (no raw `design_submitted`); no horizontal overflow at 375 px; buttons ≥ 44 px tall.
- [ ] **Step 2:** Run smoke against the current build → FAIL.
- [ ] **Step 3:** Implement: tabs become Jobs, Inbox, Profile, Fleet (the `tickets` tab key becomes `inbox`); header shows the availability switch (`role="switch"`, name "Accepting work"); profile form fields labelled Capabilities, Build volume (mm), Price per gram (INR), Minimum order (INR), Lead time (days), About your shop; one Save button; errors from the API shown inline.
- [ ] **Step 4:** Build, lint changed files, smoke PASS.

### Task 6: Creator-side matching UI

**Files:** Modify `frontend/src/app/collaboration/page.tsx`; extend `frontend/scripts/partner-smoke.mjs` or add `frontend/scripts/collaboration-smoke.mjs` (and add it to nothing else).

- [ ] **Step 1: Failing smoke:** with a creator fixture, partner cards show lead time ("N days"), price per gram, minimum order and build volume; technology and material filter controls send `technology` / `material_type` query params; empty list shows "No print partners are taking work right now."; no overflow at 375 px.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement the card fields, two filter selects, empty state. **Step 4:** PASS.

### Task 7: Verification, migration note, review

- [ ] **Step 1:** From `backend/`: full `python -m pytest -q -p no:cacheprovider` green. From `frontend/`: `npm run test:unit`, `npx tsc --noEmit`, `npm run lint:critical`, ESLint on changed files (no new errors versus `git show HEAD:` copies), `npm run build`; production-build smoke: `partner-smoke`, `marketplace-smoke`, `customer-options-smoke`, `auth-smoke`, `support-smoke`.
- [ ] **Step 2:** Read `render.yaml` start/pre-deploy commands and write `docs/partner-hub-migration.md`: whether migrations run automatically, the exact command to run, the backup step, and the rollback (`alembic downgrade d9f2a7b6c104`).
- [ ] **Step 3:** Screenshots of the hub (Profile, Inbox, switch) and the creator partner cards at 375 and 1280 px.
- [ ] **Step 4:** One fresh whole-change review (superpowers:requesting-code-review) with the Review Focus list; apply Critical/Important fixes test-first; report rulings, deferred minors, and limits (migration not applied to any database; real partner flows not exercised end to end).
