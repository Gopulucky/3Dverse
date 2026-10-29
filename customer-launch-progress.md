# Customer launch progress — plan: docs/superpowers/plans/2026-10-29-customer-launch.md

Baseline: 6c8b7c2. Branch: feat/customer-launch-readiness. Existing docs/brand deletions and sample_images remain user-owned.

User confirmed India/INR, MIT, and clear customer purpose; additional implementation approvals are not needed for this requested scope.

## Preflight interface scan

| Tasks | Shared contract | Resolution |
| --- | --- | --- |
| 1 and 2 | Product.currency; formatMoney(amount,currency) | Task 2 owns schema/model; Task 1 owns currency utility. Legacy USD is explicit. |
| 2 and 3 | Order.delivered_at and shipping_package | Task 2 adds columns/migration; Task 3 consumes them. |
| 2 and 4 | README deployment/payment contract | Root documents implementation after Task 2 reports exact env/API details. |
| 1 | Homepage clarity and working format filters | Both are required, not decorative links. |
| 2 | Provider event authority | Persist order before payment; verify amount/currency/signature and replay safety. |
| 3 | Production errors | Never replace errors with false success; keep demo boundaries explicit. |
| 4 | Readiness claims | Tests are scoped; live providers and inventory repricing are operator requirements. |

## Status

- [x] Task 1 customer experience/catalogue
- [x] Task 2 payment/currency persistence
- [x] Task 3 identity/fulfilment safety
- [x] Task 4 documentation/CI/integration/final review

## Decisions

Current branch isolates new commits; edits stay in the existing workspace to preserve available dependencies and the user's uncommitted skill setup. File ownership prevents overlapping agent edits. Existing Stripe is retained; no merchant activation or currency conversion is assumed.

Ruling: Firebase Auth is integrated behind public web configuration and server Admin credentials, with working legacy email sign-in until configured — no Firebase project/account was available — live Google sign-in remains an operator setup step.

Ruling: public registrations always create customers; seller onboarding uses the existing explicit creator upgrade, and partner access requires operator approval — client-selected partner roles exposed customer files/jobs — old partner accounts require an operator audit.

Ruling: unsupported refund completion is blocked, not labelled successful — no provider refund integration exists — refund/payout operations remain launch requirements documented in docs/customer-launch.md.

## Final review and verification (2026-10-29)

Fresh read-only review found no Critical issues and seven Important findings. All were addressed: public role escalation, uncertain intent cancellation, account query-cache isolation, late profile refresh races, digital download actions, mixed-order return deadlines and payment resume status. Regression checks passed after each fix. The review predates final fixes; no second independent review is claimed.

- Backend full suite: 182 passed, two existing deprecation/config warnings. Command: `python -m pytest -q -p no:cacheprovider --basetemp=D:/3Dverse/backend/.test-tmp-root-final-2`.
- Frontend production build: 51 generated pages; TypeScript passed.
- Critical-flow ESLint: zero errors, one existing role-hook dependency warning. Older unchanged page lint debt remains; this is not a whole-repository lint pass.
- Currency, purchase-option and download-visibility checks passed.
- Production-build browser harness: all four suites passed (marketplace, customer options/downloads/seller entry, sign-in/session isolation, partner parcel/failure handling). These intercept APIs and bypass CSP only inside fixture contexts.
- Dependency audit after compatible Firebase pin and Zod/gRPC fixes: zero vulnerabilities.
- Payment migration SQL compilation checked by implementer; production PostgreSQL migration/concurrency and live Firebase/payment/carrier/storage/email were not exercised.

User explicitly requested commit and push after checks, including again at the end. Push the feature branch without adding user-owned docs/brand deletions, sample_images or old Hallmark audit scratch. No deployment or main-branch merge is implied.
