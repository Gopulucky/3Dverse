# 05 — Applications

How the strategy, voice and visual system apply to each real surface.
Scoped to what actually exists in the product today, plus the two
surfaces that are currently greenfield (email, `/learn`).

## App shells

Four portals — marketplace, creator studio, partner console, admin —
already exist as separate layout shells
(`marketplace-shell.tsx`, `studio-shell.tsx`, `console-shell.tsx`,
`admin-shell.tsx`). Apply the audience accent to each shell's active-state
and accent details only, never as a full-shell background tint:

| Shell | Accent | Where it shows |
|---|---|---|
| Marketplace | Violet | Active nav item, primary CTA, cart badge |
| Creator studio | Ember | Active nav item, "Sell" affordances, earnings figures |
| Partner console | Moss | Active nav item, job-queue status, capacity indicators |
| Admin | Slate | No accent — admin is neutral by design; colour there should mean status (red/amber/green), not identity |

Navbar and footer are shared chrome (`navbar.tsx`, `footer.tsx`) — these
stay neutral (slate) with the wordmark as the only brand mark, since a
signed-in user may be looking at any of the four shells from the same
chrome.

## Marketplace home

Current hero ("The Future of 3D Printing," stock Unsplash background,
"Shop Now") should be replaced with the tagline and real print photography
— see [02-verbal.md](02-verbal.md) and [03-visual.md](03-visual.md)
Photography. This is a code-pass item, tracked in
[06-gap-audit.md](06-gap-audit.md).

## PDF invoice

`backend/app/core/invoice.py` generates a real, customer-facing document
today with zero brand applied. Per the voice matrix, invoices are the
*flattest* tone — no tagline, no personality copy — but they should still
carry:

- Wordmark, small, top-left, `slate-12` (single colour, not gradient — a
  PDF at print resolution doesn't need the gradient treatment and it
  risks looking muddy on non-colour-managed viewers).
- `--font-mono` (Plex Mono) for every line-item amount, the take-rate
  breakdown, and the order ID — this is exactly the "numbers hold still
  and align" rule from typography, and a financial document is where it
  matters most.
- No accent colour beyond a single slate rule under the header — this is
  a legal-adjacent document, not a marketing surface.

## Packaging insert

`Order.packaging_insert_url` — a physical, creator-branded insert shipped
inside the box. This is explicitly the creator's own brand space, not
3DVerse's: 3DVerse's presence here should be a small "Made on 3DVerse" /
wordmark credit line only, sized to not compete with the creator's own
identity. This is the one surface in the whole system where 3DVerse is
deliberately a supporting mark, not the lead.

## Email + notification layer (currently greenfield)

There is no transactional email system today, and the `Notification` table
is never populated — this is a real gap, not a low priority. Spec for
when it's built:

**Notification taxonomy** — extend the existing
`info / success / warning / error / order_update` types with the accent
system: `order_update` notifications tied to a specific role context
(a creator's sale vs. a partner's new job) should carry that audience's
accent as a small left-border or icon tint, not the whole notification.

**Subject-line grammar** (email): `Object + verb, past tense` — matches
the existing in-app notification style already established informally
(`"Order #4821 shipped."`). E.g. *"Your print job was accepted"*, *"Order
#4821 refunded"*. Never a question, never an exclamation, in a
transactional subject line.

**Email body structure**, consistent across every transactional type:
1. One-line restatement of the fact (matches the subject).
2. The specific detail that matters (amount, tracking link, order ID —
   set in `--font-mono` equivalent, a monospace-styled `<span>` in HTML
   email).
3. One line of "what happens next," always present, even if it's "No
   action needed."
4. Footer: wordmark, one-line boilerplate (see [02-verbal.md](02-verbal.md)),
   unsubscribe/settings link.

No marketing tone, no upsell, in a transactional email. If a
marketing/digest email type is added later, it earns the marketing voice
from the tone matrix — transactional and marketing are different products
that happen to share a sender.

## OG / social cards

None exist today (`06-gap-audit.md`). Spec: `slate-1` or `slate-12`
background (light/dark variant), wordmark centered or left-aligned, the
tagline as supporting text, optionally a real product photo per specific
listing (for per-model share cards, once that's built). Generate via
Next.js's `opengraph-image` file convention once implemented.

## Pitch deck / external-facing docs

Title slides: `slate-1` background, wordmark, positioning line, no
gradient background treatments (they photograph poorly projected). Body
slides: `heading-*`/`body-*` type scale, one accent colour per slide
maximum, sourced from whichever audience or pillar that slide is about.

## A `/learn` hub — proposal for later

Anthropic's `/learn` segments by *who you are* before *what you want to
learn* — "Build with Claude" / "Claude for work" / "Claude for personal" —
then layers courses, tutorials, and customer stories inside each. 3DVerse
already has the identical shape at the account-role level. If a `/learn`
or help-center surface gets built, mirror that structure directly instead
of inventing a generic FAQ taxonomy:

- **For Creators** — printability reports explained, pricing your first
  listing, commissions, payouts and royalties.
- **For Customers** — how printability checking protects you, reading a
  listing, returns and defects.
- **For Print Partners** — how job routing works, the certification
  process, building a reliability record.

Plus a shared layer underneath (platform-wide: account security, general
FAQ) — the same "three audiences, one shared base" shape used throughout
this brand book.
