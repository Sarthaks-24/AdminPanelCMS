# Changelog

Changes to the public API, its limits, and the Terms and Privacy Policy, newest first. Additive API changes may ship without an entry; anything that could break your code, and every change to the limits or the legal text, is posted here first. The rules are in [Stability](API_REFERENCE.md#stability).

## 2026-10-12 (later)

- **Limits:** the per-IP limit before the key is checked is raised from 300 to 1,200 requests a minute, so one build server can reach its secret key's 600/minute limit. Nothing else changes.
- **Deprecated:** `driveUrl` on `/v1/resume` is always the same value as `resumeUrl` and is not a separate link. It keeps being served to Apps that opted in; use `resumeUrl`.

## 2026-10-12

- **Docs:** every path in the docs is now written in full from the base URL, for example `{{API_BASE}}/v1/projects`.
- **Terms and Privacy:** the operator, contact addresses and sub-processors are named in one place; the typefaces are now served from our own servers, so no third party receives your IP address when you load the site. New version `2026-10-12`.
- **API:** the `/v1` contract is unchanged.

## 2026-10-11

- **Beta opens by invitation.** The `/v1` read-only API, Apps with publishable and secret keys, and the limits in [Limits & errors](LIMITS_AND_ERRORS.md).
