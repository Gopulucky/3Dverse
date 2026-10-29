# Security

Do not publish vulnerabilities containing customer data, private file URLs, credentials or account-takeover instructions in a public issue.

Use [GitHub private vulnerability reporting](https://github.com/Gopulucky/3Dverse/security/advisories/new) when available. If reporting is disabled, ask the maintainer to enable a private reporting channel without disclosing exploit details publicly.

Include the affected revision, reproduction steps using test accounts, impact and a proposed fix if available. Avoid testing against real customers or disrupting deployed services.

Only the current maintained branch receives fixes; there is no response-time or support-service guarantee. Operators must rotate exposed credentials, review access logs, maintain database/object-store backups, and validate restore procedures.
