# 02 — Verbal Identity

## Rule 1: the name, non-negotiable

**3DVerse.** Capital 3, capital D, no space, capital V, lowercase `erse`.

Never: `3Dverse`, `3D-Verse`, `3DVERSE`, `3dverse`, `3D Verse`.

This is currently violated in shipped copy —
[sell-with-3dverse.tsx:59](../../frontend/src/components/creator/sell-with-3dverse.tsx#L59)
renders `"Sell with 3Dverse"` while
[navbar.tsx:508](../../frontend/src/components/layout/navbar.tsx#L508) gets
it right. Tracked in [06-gap-audit.md](06-gap-audit.md); fix by referencing
`BRAND.name`, never retyping the string.

## Tagline

> **Upload Once. Sell Forever. Print Anywhere.**

Use in full, in this order, wherever a single line of brand copy is needed
above the fold. Don't truncate to two clauses — the third clause is the
customer/partner promise and dropping it turns the line into
creator-only copy.

## Messaging pillars

The three systems from [01-strategy.md](01-strategy.md), condensed to
their one-line pitch for use in nav, footers, and section headers:

1. **The Marketplace** — browse and buy, no account required.
2. **The AI Manufacturing Assistant** — every upload checked before it
   ever reaches a customer.
3. **The Print Network** — routed to the nearest shop that can actually
   make it.

## Voice & tone matrix

Voice is constant; tone shifts by surface. The audit found marketing copy
and dashboard copy currently read like two different products — this
table is what closes that gap.

| Surface | Tone | Example (do) | Anti-example (don't) |
|---|---|---|---|
| **Marketing** (about, landing) | Declarative, confident, short sentences | "We're building the operating system for physical creation." | "The Future of 3D Printing" — generic, could be any 3D-printing company |
| **Dashboard** (creator/partner/admin) | Plain, task-focused, no exclamation | "3 orders need a printability check." | "Your dashboard is looking great! 🎉" |
| **Empty state** | One sentence, states the fact, offers the next action | "No printers yet. Add your first one." | "No printers yet" *(no next step)* or "Oops! Nothing here" *(cute, unhelpful)* |
| **Error** | Names what happened and what to do, no blame | "That file couldn't be validated — check it's a valid STL, OBJ or GLTF." | "Something went wrong." |
| **Notification / in-app** | Short, factual, leads with the object not the system | "Order #4821 shipped." | "We wanted to let you know that your order has shipped!" |
| **Transactional email** | Same facts as notification, one added line of context, always includes a next action | Subject: "Your order shipped — #4821". Body: fact, tracking link, one line of what happens next. | Marketing tone leaking into a receipt ("Get ready to love your new print!") |
| **Invoice / legal-adjacent** | Neutral, no brand voice at all — this is a financial document | Line items, totals, take-rate breakdown, plain labels | Any tagline, slogan, or personality copy |
| **Support / help copy** | Second person, patient, assumes the reader is mid-task and slightly frustrated | "If your print failed a printability check, here's why, and how to fix the file." | Jargon without explanation ("Your PPR flagged non-manifold geometry.") |

Rule of thumb: **the closer to money or a broken state, the flatter the
tone.** Personality shows up in marketing and in principles, not in error
messages or invoices.

## Vocabulary

### Say this (the platform's actual nouns — lock these, they map to real
schema fields)

| Say | Not |
|---|---|
| listing / product | item, thing |
| model (the 3D file) | design *(only when referring to the file itself — "design" is fine for the creative act)* |
| print / print job | order *(only when specifically the manufacturing step, distinct from the commerce order)* |
| creator | seller, vendor, artist *(unless quoting a creator's own bio)* |
| customer | buyer, user *(reserve "user" for auth/account contexts only)* |
| print partner | manufacturer, fulfilment center |
| take rate / creator payout | commission, cut |
| royalty | — |
| spool / filament | material *(use "material" only for the general category — filament, resin, powder, metal)* |
| make-photo | customer photo, review photo |
| printability report | quality check *(printability ≠ safety — see the distinction below)* |
| commission (custom work) | quote, request *(reserve for the specific custom-design flow)* |

**Printability vs. safety — a real distinction in the schema, keep it in
copy too.** A printability report says the geometry is manufacturable. A
safety review says it should be manufactured at all (declining functional
weapon components, lock-picking tools, etc.). Never collapse these into
one "approved" status in user-facing copy — they answer different
questions and a creator needs to know which one failed.

### Never say

Generic e-commerce filler that could belong to any marketplace and
actively works against the "operating system" positioning:

- **"Shop Now"** — the current homepage CTA. Replace with a verb tied to
  what's actually happening: "Browse the marketplace," "Explore models."
- **"Premium"** — used in the current meta description
  ("The premium marketplace..."). Show quality through the printability
  report and take-rate transparency; don't claim it as an adjective.
- **"World-class"** — same issue, unearned superlative.
- **"Best-in-class," "seamless," "revolutionary," "game-changing"** — filler
  that signals nothing and is banned across every brand's style guide for
  a reason.
- Exclamation points in dashboard, error, or transactional copy (marketing
  headlines may use one, sparingly).

## Boilerplate

**One sentence** (bios, directory listings):
> 3DVerse is the operating system for 3D commerce — a marketplace, an AI
> manufacturing assistant, and a distributed print network operating as
> one system.

**Two sentences** (press, about-us summaries):
> 3DVerse is the operating system for 3D commerce. It connects creators,
> customers and print partners on one platform — every model validated for
> printability before it's sold, every order routed to the nearest capable
> printer.

**Full one-liner** (metadata, about hero — see `BRAND.oneLiner`):
> 3DVerse is the infrastructure layer for physical creation — a
> marketplace, an AI manufacturing assistant, and a distributed print
> network operating as one system.
