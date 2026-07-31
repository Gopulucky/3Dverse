# 3DVerse Brand Book

**Status:** v1 — first complete edition. Supersedes everything that lived in
`frontend/src/lib/brand.ts` and the design-token comments in `globals.css`
before this date. Those files are not deleted (they're load-bearing in the
app today) but they are now *implementations* of what's written here, not
the source of truth themselves.

**Why this exists:** the platform had brand fragments — a tagline here, a
colour token there, a deleted logo-rules comment surviving only in git
history — but no single place that decided anything. Two files already
disagreed about what 3DVerse's positioning statement is. This directory is
where that stops.

## How to use this

You are one of three kinds of reader:

- **Writing product copy?** Read [02-verbal.md](02-verbal.md). It has the
  casing law, the tagline, the messaging pillars, and — most useful day to
  day — a vocabulary table of which words are 3DVerse's and which are
  generic e-commerce filler to delete on sight.
- **Building UI?** Read [03-visual.md](03-visual.md) for the *decisions*
  (why these colours, why this type) and [04-technical.md](04-technical.md)
  for the *values* (exact tokens, contrast table, clear-space rules) you
  actually paste into code.
- **Planning what ships next?** Read [01-strategy.md](01-strategy.md) for
  positioning and audiences, [05-applications.md](05-applications.md) for
  how the brand should look on a surface that doesn't exist yet (email,
  invoice, deck), and [06-gap-audit.md](06-gap-audit.md) for the concrete,
  file-and-line list of where the live product currently contradicts this
  document.

## Reading order

| File | Answers |
|---|---|
| [01-strategy.md](01-strategy.md) | Who are we, who is this for, what do we refuse to be |
| [02-verbal.md](02-verbal.md) | What do we call things, how do we sound |
| [03-visual.md](03-visual.md) | What does it look like, and why these choices |
| [04-technical.md](04-technical.md) | Exact tokens, contrast proof, clear space, misuse |
| [05-applications.md](05-applications.md) | How the system applies per surface |
| [06-gap-audit.md](06-gap-audit.md) | Where the codebase disagrees with this document today |

## Rules for this document itself

1. **One page ≠ one decision.** If a section starts collecting a second
   unrelated topic, split the file. Don't let any one file become the next
   file nobody reads to the end.
2. **Every colour and font name here must resolve to a real token.**
   `04-technical.md` is the only place hex values are allowed to appear
   uncommented — everywhere else, reference the semantic name.
3. **Nothing is deleted without a replacement decision recorded.** The
   `24c5648` incident — colour, type and logo rules quietly vanishing with
   no trace but a git diff — is the failure mode this rule exists to
   prevent.
4. **When code and doc disagree, the doc wins until someone changes the
   doc.** Log the disagreement in `06-gap-audit.md` immediately; don't let
   the drift sit unrecorded the way it did for weeks before this edition.

## Changelog

- **v1 (this edition)** — First complete brand book. Restored and
  formalized the colour/type/logo rules deleted in `24c5648`; converted the
  hand-picked hex palette into a contrast-verified 12-step OKLCH system;
  added strategy, verbal, technical, application and gap-audit layers that
  did not exist in any form before. Produced as a document only — no
  application code changed in this pass.
