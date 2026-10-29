# 3DVerse storefront changes

Implemented 29 October 2026 for the shared `/` and `/marketplace/home` homepage.

## Result

- Brand-preserving Catalogue composition: product-led Stage hero, featured grid, typographic category index, trending rail, new-arrival rows, creator list and existing hub footer.
- The hero selects an actual API listing with image media. It uses that listing's title, creator, price and detail link. Missing catalogue imagery produces an honest typographic hero, with no invented product or substitute marketing image.
- View model navigates; Add to cart is a separate native button outside links. Cart item count uses the returned cart rather than incrementing incorrectly for repeat additions.
- Review counts are labelled reviews. Printability passed is shown only when the latest version's report says pass.
- Inert View All buttons became catalogue links. Unsupported Follow buttons were removed; creator names, roles and uploaded avatars remain.
- Image failure produces a labelled fallback; videos are excluded from image selection.
- Homepage loading, empty, initial error and stale-data refresh-error states are explicit. Retry uses the existing API client without multiplying its retry cycle.
- Search uses native labelled inputs/buttons and keyboard-activatable suggestions. Category keyboard selection uses the selected category immediately. Mobile navigation has real destinations, search, Escape/focus handling, and desktop-resize cleanup.
- Shared canvas, quieter controls, sentence-case labels, explicit transition properties and reduced-motion support. Dark palette declarations now live in the token stylesheet.
- Next/font variable classes moved to html so root font aliases resolve to the real brand faces.

## Copy changes

- Hero supporting sentence: “Every listing is checked for printability before it ever reaches you.” to “Discover 3D designs, download a model, or order a physical print.” The full brand tagline stays unchanged.
- “View All” to “Browse all models”; links go to the existing catalogue.
- “View Model” to “View model”, with navigation rather than an unexpected cart mutation.
- “Downloads” to “reviews”, because the source field is review_count.
- Unconditional “Printable” to report-backed “Printability passed”.
- Unsupported mobile categories All / Deals / CustomerService became actual browse, sell, orders and contact destinations, as requested in the audit fixes.
- Legal/footer consent wording is unchanged.

## Verification

- Production build: passed, all 50 routes generated; TypeScript passed.
- ESLint: changed TypeScript/TSX files and smoke script passed without warnings.
- Pre-commit verification: production build and strict changed-file ESLint passed again; backend pytest passed all 78 tests (two existing dependency deprecation/configuration warnings). Browser regression groups also passed using the embedded image fallback, so the script does not depend on the untracked sample_images directory.
- Browser regression script: all seven groups passed against development and production servers. Isolated browser fixtures cover cart requests and repeated additions, review/report labels, 320/375/768/1280/1440/1920px layout, loaded brand fonts, mobile search and Escape/focus, loading/empty states and API-outage recovery. Production results are recorded in verification/results.json. The fixture browser bypasses CSP because production correctly blocks the cross-port HTTP localhost API; this does not change the application's CSP or verify deployed networking.
- Primary-action text contrast: 5.45:1 light and 4.87:1 dark. Focus is visible in both modes.
- Hero review: ship. Finish review: ship after captures were synchronized with image painting. No concrete remaining visual findings; no before-image comparison was possible.
- Screenshots and browser results: `.hallmark/verification/`. These are explicitly QA catalogue fixtures using the local sample image, not production inventory, photography or social proof.

## Hallmark audit interpretation

Final static audit: 0 Floor failures, 1 Reflex finding, 11 warnings. Record: after-static.json. All 11 original source links are preserved. Five exact handler strings changed intentionally: image errors moved to shared ProductImage, and suggestion activation changed from mouse-down to click for keyboard support. These changes are recorded in the CSS stamp.

The single remaining Reflex is the original gradient wordmark. It is an intentional brand exception: the existing identity explicitly preserves that mark. It is not used on ordinary headings. Hallmark's narrow single-hue waiver guard cannot represent this brand requirement; no automatic clean lint result is claimed.

Warning review: existing legal footer copy retained (19); four footer link groups are real sitemap destinations (42); brand swatches retained intentionally (74); the numeric-selector warning refers to h2 rather than an actual displayed statistic (F6); selection is already themed in globals.css (F16); search text is constrained by whitespace-nowrap/overflow-hidden (49). Static contrast warnings merge light/dark variables and are not a substitute for browser-computed pairs. The hero image itself has no text overlay; fallback/caption text uses semantic colours (41). The visual review found no badge/readability defects (40).

Hallmark's Puppeteer render transport timed out, including an attempted pipe transport. Required --render commands were attempted; Playwright provided the actual screenshots, size checks and control verification. No Hallmark render-tier pass is claimed.

## Remaining limits and material

Customer launch follow-up (2026-10-29): retained the violet/type system while replacing the opening copy with explicit printed-product versus digital-file choices. Added working format entry points and a short buying explanation. Customer sign-in now explains orders/file access, offers guest browsing and keeps seller onboarding secondary. New catalogue, sign-in, downloads and partner fixture suites pass against the production build; existing homepage width/theme/focus checks still pass. Firebase/provider activation and deployed networking remain external verification steps.

The backend was unavailable locally. No real inventory, accounts, purchases or fulfilment were exercised; functional browser checks used intercepted API fixtures. No production sample catalogue data or image asset was added. A live API with real listing images will populate the hero automatically.

No empty image slots were introduced. Hero imagery uses a square presentation up to 576px high; product cards use square images. Actual print photography attached to catalogue listings would improve the page most.

The docs/brand directory and unrelated untracked files were removed externally during the run. Those removals were not made or reverted by this work. The captured design values are self-contained in frontend/design.md and the existing token/code sources.
