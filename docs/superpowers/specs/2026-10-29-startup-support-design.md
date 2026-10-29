# Startup support

Add a public `/support` page, discoverable from the footer, for optional one-time contributions to 3DVerse's maintenance and growth. Preserve the existing storefront design and guest browsing.

Use a merchant-hosted HTTPS payment page supplied by the owner. This needs no marketplace account and keeps payment details with the provider. The owner has been asked for a payment link or UPI destination; no destination has been supplied. A hosted page is preferred to a new payment ledger or a bare UPI link because it can display the recipient, amount, currency and payment result in one place.

Server environment `SUPPORT_PAYMENT_URL` enables the action. Only an absolute HTTPS URL without credentials is accepted. Missing or invalid configuration displays an honest unavailable state and contact link. No invented payee, amount, fundraising totals, tax benefit, reward or investment promise. Query parameters on this page never constitute payment confirmation. The provider handles payment confirmation and receipts; contributions do not create store orders or account privileges.

The page explains hosting/storage/reliability and product development, and offers a secondary return to browsing. Small screens, keyboard access and dark mode use the existing tokens and controls. Add metadata, sitemap discovery, operator instructions and checks for configured/unconfigured destinations.

Activation requires the owner to configure an appropriate live merchant payment page and verify its recipient, INR currency, receipt and refund/contact process. Code checks cannot certify the merchant account or a real transfer.
