# 01 — Strategy

## Positioning

> **The Operating System for 3D Commerce.**

Not a marketplace with extras bolted on. An operating system implies three
things running as one layer underneath — and that's the literal product
shape: a catalogue, a manufacturing-validation engine, and a distributed
print network, unified by one identity. Keep this line; it's already
correct and it's rare that a two-year-old positioning statement survives
contact with what got built.

## Mission

> **Make manufacturing as accessible as publishing.**

Publishing a book or a song costs almost nothing today. Manufacturing a
physical object still demands machines, materials, logistics and capital —
that gap is why most good designs never become real things. 3DVerse closes
it so a designer with a file can reach a customer anywhere without owning a
printer.

## One-liner (for metadata, bios, the about hero)

> 3DVerse is the infrastructure layer for physical creation — a
> marketplace, an AI manufacturing assistant, and a distributed print
> network operating as one system.

## Tagline

> **Upload Once. Sell Forever. Print Anywhere.**

Three clauses, three audiences, in order: *Upload* is the creator's verb,
*Sell* is the creator's outcome, *Print Anywhere* is the customer's and
partner's promise. It is audience-shaped by construction — see
[02-verbal.md](02-verbal.md) for why this beats the generic e-commerce copy
currently live on the homepage.

## Competitive frame

State plainly what 3DVerse is not, because the category is crowded with
things that look adjacent:

| They are | We are not that, because |
|---|---|
| **Thingiverse / Printables** — free file archives | No commerce layer, no validation, no fulfilment. A file dump, not a business. |
| **Etsy** — a general handmade-goods marketplace | No manufacturing layer. A seller on Etsy still needs their own printer, their own logistics, their own QA. |
| **Shapeways** — print-on-demand manufacturing | No creator marketplace or brand relationship. You get a part, not a designer's storefront. |
| **A local print shop's own website** | No discovery, no cross-shop routing, no printability validation before a customer ever sees the file. |

3DVerse is the only one of these that is a marketplace *and* a manufacturing
network *and* a validation layer, held together as one product. That
combination — not any single piece — is the moat, and it's why the
"operating system" framing is earned rather than aspirational.

## Brand personality

Five pairs, each stated as "we are X, not Y" so the boundary is explicit,
not just a mood board:

1. **Confident, not boastful.** We say "the operating system for 3D
   commerce" once, plainly, and then get out of the way. We don't say
   "world-class" or "premium" about ourselves — see the banned-words list
   in [02-verbal.md](02-verbal.md).
2. **Technical, not cold.** Layer lines, take rates, printability reports —
   real numbers, shown plainly. But the six principles below are written
   like a person who cares, not a compliance document.
3. **Direct, not blunt.** "Say the real number" means publishing bad
   numbers, not being rude about it. Directness is a form of respect for
   the reader's time, not an excuse to be terse for its own sake.
4. **Systemic, not corporate.** We talk about the network — three sides
   making each other more valuable — rather than about the company as an
   institution. There is no "leadership team" voice anywhere in this brand.
5. **Optimistic about making things, skeptical of hype.** AI is a real,
   named part of the product (the Manufacturing Assistant) and it is
   scoped precisely: it handles printability, pricing signals and routing —
   never taste. See Principle 4 below.

## Mission-supporting principles

Carried over from the existing `brand.ts` — genuinely strong, unusual
enough to be worth keeping verbatim rather than re-writing for the sake of
it:

1. **Creators come first.** The platform is worth exactly what creators
   can earn on it. Pricing, payouts and product decisions get judged
   against that before anything else.
2. **Ship the whole loop.** A marketplace without fulfilment is a
   catalogue. We take responsibility for the entire path — upload,
   validation, sale, print, delivery, payout.
3. **Trust is a product feature.** Every model is checked before it is
   sold. Every print partner is vetted. Buyers should never have to gamble
   on whether a file will actually print.
4. **Automate the tedious, never the taste.** AI handles printability,
   pricing signals and routing. It does not decide what is worth making.
5. **Local by default.** The nearest capable printer wins the job. Shorter
   routes mean faster delivery, lower cost, less freight burned moving
   plastic across the world.
6. **Say the real number.** Take rates, print success rates, delivery
   estimates and payout timing are published plainly. If a number is bad,
   we show the bad number.

## The three audiences

3DVerse is not one brand wearing three hats — it's three real jobs, each
with their own anxieties, running on one identity. This structure mirrors
Anthropic's `/learn` hub, which segments by *who you are* before it
segments by topic; here it's not a marketing pattern borrowed for effect —
it's the literal shape of `UserRole` in the schema (`creator`, `customer`,
`print_partner`).

| | **Creators** | **Customers** | **Print Partners** |
|---|---|---|---|
| **Headline** | Designers who turn files into a business. | Buyers who want the object, not the hassle. | Print shops that turn idle machines into income. |
| **Job to be done** | Turn a design skill into recurring revenue without becoming a logistics company. | Get a specific physical object made correctly, without learning anything about 3D printing. | Monetize printer capacity that already sits idle most of the day. |
| **Anxiety we must answer** | "Will this actually sell, and will I get paid what I'm owed, on time?" | "Will this file actually print, or am I gambling on a stranger's upload?" | "Will I get real jobs, or spam I have to filter myself?" |
| **The one sentence they should repeat back** | "I upload once and it keeps selling." | "Every listing is already checked — I'm not the QA." | "Jobs come pre-validated, and I choose what I take." |
| **Brand accent** | Ember `#EA580C` | Violet `#6366F1` | Moss `#059669` |

The accent-per-audience convention currently survives only as a local
constant in `about/page.tsx`. It's promoted here to a platform-wide rule —
see [03-visual.md](03-visual.md) and [04-technical.md](04-technical.md) for
where it must and must not be applied.

## The three systems (product pillars)

1. **The Marketplace** — an open catalogue of 3D models, browsable by
   anyone without an account. Creators list; customers buy digital files,
   printed goods, or commissioned work.
2. **The AI Manufacturing Assistant** — every upload is analysed for
   printability, material fit, predicted print success and pricing.
   Creators get a report instead of a silent "upload complete."
3. **The Print Network** — a distributed grid of vetted print shops and
   creator-owned machines. Orders route to the nearest partner that can
   actually make the thing.

None of these three is novel alone. The brand's actual claim is that they
run as one system — say this plainly in marketing copy rather than
implying it.
