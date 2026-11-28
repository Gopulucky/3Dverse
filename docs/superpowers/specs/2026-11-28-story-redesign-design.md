# Story redesign: buy, sell, print

Status: **replaced the same day.** The owner then asked for no scroll story, no 3D
model (own designs later), product cards straight after the hero and a minimal look.
`frontend/design.md` has the current rules.

## Intent

The site should look like it belongs in a design gallery (awwwards, siteinspire):
generous space, large expressive type, and a home page that tells a story. A
visitor should leave knowing three things: you can buy 3D, sell 3D and print 3D
here.

## Decided by you

- Look: A (white gallery) with C's travelling object and B's font.
- Story: **Buy 3D, Sell 3D, Print 3D**.
- Logo: the name only, redrawn in the new font. No symbol.

Mock-ups were shown in chat. The built page will follow their direction, not copy
them pixel for pixel.

## The look

- **White and space.** One idea per screen, wide margins, thin dividing lines.
- **Type.** Bricolage Grotesque for headlines and the logo. Big headlines are
  heavy capitals (my call, as in mock-up B). Product names, buttons and forms stay
  in normal case. IBM Plex stays for reading text and prices.
- **Colour.** Unchanged: ink, deep teal, tangerine.
- **Buttons and fields.** Rounded pill buttons, larger tap areas.
- **Logo.** `buy&sell3d` in heavy Bricolage, tangerine `&`.
- **Footer.** The name set across the full width of the page (my proposal).
- The small capital labels above headings on About go.

## Home page

```
HERO        IDEAS YOU CAN HOLD.                      [ vase ]
            one sentence, two buttons                   |
BUY 3D      "Pick it. Own it."  + 3 newest products     |  one vase,
SELL 3D     "Your design, your shop."  Start selling    |  pinned,
PRINT 3D    "Print at home, or print for others."       |  changing
            ----------------------------------------------
            New arrivals · Trending · trust strip · big footer
```

| Chapter | The vase | Button goes to |
|---|---|---|
| Hero | prints itself, then turns | Printed products, Digital models |
| Buy 3D | finished, solid | `/marketplace` |
| Sell 3D | becomes a wireframe: your design file | `/sell` |
| Print 3D | prints again, layer by layer | `/sell#partners` |

Chapter text (edit freely):

- Buy: "Finished prints delivered in India, or the file to print at home." While
  printed orders are off: "Files to print at home today. Finished prints are
  coming soon."
- Sell: "Upload a model, set your price, and list it as a file or a finished
  print."
- Print: "Print your downloads at home. Run a print shop? Ask to join us."

On phones and with animation off, nothing is pinned: each chapter shows its own
still drawing of the vase. The page never takes over scrolling.

**Rules that change.** The home page has so far been for buyers only, with no
seller or print-partner promotion. Your story adds both. Kept: both hero buttons
on the first screen, first product within one scroll, no product twice, no
invented products, numbers or reviews. The limit of 80 words before the first
product stays.

## The rest of the site

| Pages | What changes |
|---|---|
| Catalogue, product, creator, About, Sell, sign-in | New layout and spacing, large headlines, new buttons |
| Cart, checkout, orders, account, legal, dashboards | New font, buttons, header and spacing. Layout and steps unchanged |

All behaviour, links, forms, prices and payment stay as they are.

## Order of work

Each stage is shown to you before the next.

1. Font, logo, buttons, header, footer (reaches every page).
2. Home page story.
3. Catalogue, product, creator, About, Sell, sign-in.

## Approaches for the travelling vase

1. **One pinned 3D vase that changes when a chapter comes into view.** Extends the
   scene already built. **My pick.**
2. Four flat drawings that cross-fade. Lighter, less striking. Used anyway as the
   phone and animation-off version.
3. The scroll position drives every frame of the change. Most cinematic, likely to
   stutter on cheap phones and needs an animation library.

## Needs your permission

Download for the new font, into the project, from Google's official fonts
repository on GitHub (`google/fonts`, same pinned version the other fonts use):

- `ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf`, 408 KB
- `ofl/bricolagegrotesque/OFL.txt` (free licence), 4 KB

Plus the Python packages `fonttools` and `brotli` from PyPI, a few MB, in a
temporary folder outside the project, to trim the font. The trimmed file the site
ships will be much smaller than 408 KB. Space Grotesk is then removed.

## Not doing

- No new colours, symbol, stock photos or partner logo walls.
- No backend, price, checkout or account changes.
- The browser-tab icon and link-preview image keep their current font.

## Checks

Unit tests for the chapter logic and the font setup; browser tests for the story
(chapter changes, links, phone and animation-off versions, no sideways scroll,
320 to 1920 px); the existing suite; Hallmark's linter; screenshots in day, night
and phone views. `frontend/design.md` and the brand rules in `brand.ts` updated.
Not verified: low-end phone frame rate, Safari, a live backend.

## What would help most

Real photos of your printed products. The design leaves large spaces that
drawings alone will not fill as well.
