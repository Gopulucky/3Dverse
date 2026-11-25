# Audience popup and decision-driven questions: design

Approved by the owner in conversation on 2026-11-14 ("Yes, build it"), after the owner rejected the first question set ("these questions don't get us anywhere") and asked for questions that tell them who the audience is, where they are and what they want, so the idea can become a business.

## Intent
The home-page waitlist card asked what people would buy and what they would pay: stated answers that drive no decision, in a card visitors must scroll to. Replace it with a short popup whose every question maps to a business decision (audience, location, assortment, digital vs printed, made-to-order, competitors, price level, difference), and tie the answers to the anonymous funnel visitor so behaviour can be compared by audience.

## Goals
- Remove the card from the home page. A popup opens once: after about 15 seconds on the storefront, or when the visitor opens a second product page, whichever comes first. Storefront pages only (`/` and `/marketplace...`). Closing or finishing it snoozes it (14 days after closing, a year after finishing). A small button on the home page opens it on demand while printing is "coming soon".
- Three answer steps and a contact step, tap-based, about a minute. Answers save when the visitor presses Next (partial answers count). Only email is required, and only to be told at launch.
- Questions (values are shared by backend and frontend):
  1. Role: student, hobbyist, professional, parent, business, designer, other.
  2. City (free text, optional).
  3. Uses (pick up to two): gifts, home_decor, hobby, college_project, useful_parts, my_shop, sell_designs, exploring.
  4. Occasions (only if gifts picked): birthday, wedding, festival, corporate, none.
  5. Owns a 3D printer: yes, no, planning.
  6. Wants personalisation: always, sometimes, no.
  7. Where they last bought a gift/decor/custom item: marketplace, etsy_instagram, local_shop, made_it, never.
  8. What that cost (asked only after marketplace, etsy_instagram or local_shop): under_500, 500_1500, 1500_3000, over_3000.
  9. One line: what is missing or annoying today (max 280 characters).
  10. Email (required to be notified, with consent), optional WhatsApp number (Indian mobile), tick box "OK if we ask 2-3 quick questions by chat".
- Admin "Audience" page: counts per question, top cities, uses by role, latest free-text answers, CSV export, and a plain "what this suggests" panel that appears only once there are at least 30 responses.
- Answers are linked to the anonymous visitor id from funnel tracking (disclosed on the privacy page). `audience_shown` is added to the funnel; `waitlist_joined` is recorded when the contact step is submitted.

## Non-goals
Price-choice question, age question, A/B testing, email sending, deleting the old waitlist table, endpoint or admin page (existing signups stay readable).

## Anti-goals
Never block the page or a purchase; never require more than an email; never expose email, WhatsApp or free text to anyone but admins; never tell the owner a trend from a handful of answers.

## Approaches
- A. Extend `waitlist_signups` with the new columns. Rejected: it is keyed by unique email, so partial answers from people who never give an email could not be stored.
- B. **Chosen.** New `audience_responses` table keyed by a client-generated `response_id` (upsert), email optional; the old waitlist endpoint and table stay for existing data.
- C. Two tables (anonymous answers, separate email list) to keep identity unlinked. Rejected: the owner wants to follow up by chat with specific people, which needs answers and contact together.

## Design
Backend: `AudienceResponse` model and migration (additive); `POST /api/audience` (public, rate limited, validated Literals, always 204, merges only provided fields, never overwrites with null; email/WhatsApp/chat tick need `consent: true`); `GET /api/audience/admin` (admin only) returning `summarise()` plus `suggest()` output. Pure functions `summarise(rows)` and `suggest(summary)`.
Frontend: `lib/audience.ts` (options, validation, payloads, CSV), `lib/audience-schedule.ts` (when to open, snooze), `lib/machines/audience-popup.ts` (flow reducer, `data-flow="audience"`), `components/marketplace/audience-popup.tsx` (Radix dialog, mounted in the root layout), `app/admin/audience/page.tsx`.

## Left to the builder
Copy, exact styling (reuse the old card's pill controls), thresholds in `suggest()` (documented in code).
