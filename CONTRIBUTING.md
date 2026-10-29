# Contributing

3DVerse serves customers buying printed products and digital 3D files. Changes should make that journey easier to understand and more reliable.

Use the setup and verification commands in the README. Work on a branch, keep pull requests focused, and describe the customer problem, resulting behaviour and checks run. Include screenshots for visual changes and distinguish fixture tests from real-service verification.

Follow `AGENTS.md` and the frontend design notes when using coding agents. Preserve unrelated local edits. Behaviour changes need meaningful regression coverage, especially around account identity, price/currency, payment status and private files.

Do not include credentials, customer information, uploaded designs or production database exports. Seed data belongs in development only. Report security issues privately using `SECURITY.md`.
