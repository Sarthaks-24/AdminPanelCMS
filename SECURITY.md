# Security policy

Portfolio Control is a hosted service. This policy covers the service at https://[your-domain], its API, and the source code in this repository.

## Reporting a vulnerability

Email **security@[your-domain]**. Please don't open a public issue, pull request or discussion for a security problem.

Include what you found, where (URL, endpoint or file), how to reproduce it, and what an attacker could do with it. A `requestId` from an API response helps.

What to expect:

- an acknowledgement within 3 working days;
- an assessment, and a fix or a plan, within 14 days for anything serious;
- credit in the [changelog](docs/CHANGELOG.md) once it is fixed, if you want it.

The same contact is published at `/.well-known/security.txt`.

## Scope and rules

In scope: the public site and dashboard, the `/v1` API and the `/api` dashboard API.

Please:

- test only against your own account and your own Apps and keys;
- never read, change or delete another user's data, and stop as soon as you see any;
- don't run denial-of-service or load tests, automated signups, or spam the mail endpoints;
- give us reasonable time to fix an issue before you disclose it.

Good-faith research that follows these rules will not be pursued.

## Abuse and takedown

Content published through the service that breaks the Terms (impersonation, someone else's personal data, malware links) goes to **abuse@[your-domain]**, not to the security address.
