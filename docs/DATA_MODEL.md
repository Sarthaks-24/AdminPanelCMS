# Data model

MongoDB collections, as defined by the Mongoose schemas in `server/models/`. The schemas are the source of truth; this page summarises them. Field caps are the contract numbers from the 2026-10-11 council pass.

## Overview

| Collection | Model | Per account | Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `User` | | Accounts, credentials, consent, status |
| `profiles` | `Profile` | at most one (written on first save) | Name, bio, contact, availability |
| `resumes` | `Resume` | at most one | Link to the resume file |
| `projects` | `Project` | up to 100 | Case studies |
| `skills` | `Skill` | up to 100 | Skills in the tenant's own categories |
| `socials` | `Social` | up to 100 | External links |
| `experiences` | `Experience` | up to 100 | Work history |
| `educations` | `Education` | up to 100 | Education |
| `certifications` | `Certification` | up to 100 | Certifications |
| `apps` | `App` | up to 10 | What each consumer may read |
| `apitokens` | `ApiToken` | 2 active per App | `/v1` credentials (keys) |
| `emailtokens` | `EmailToken` | | Verification and reset links |
| `invites` | `Invite` | | Signup invite codes |
| `settings` | `Setting` | | Platform settings (signup mode, daily mail counter) |

## Ownership

Every content document, App and API token has an `owner` field: a required reference to a `User`, immutable on content and Apps.

The `ownerGuard` plugin (`server/plugins/ownerGuard.js`) is applied to all of those schemas. It throws if a query, update, delete or count runs without a concrete `owner` ObjectId in its filter, if an aggregation does not start by matching on `owner`, or if a bulk insert lacks one. The single exemption is the API-token lookup by hash, which is how a key is authenticated before its owner is known. Bulk writes go through `scopedBulkWrite`, which checks each operation. `npm run lint:security` statically rejects code that would bypass the guard.

`User`, `EmailToken`, `Invite` and `Setting` are platform records, not tenant content, and are not guarded.

## Blank defaults

New accounts start empty. No schema default carries the operator's name, city, résumé file name or sample text any more: every string defaults to `''`, booleans such as `isAvailableForHire` and `location.isRemoteAvailable` to `false`, arrays to `[]`. The dashboard validates what a tenant must fill in before publishing; the schemas no longer mark `Profile.name`, `headline`, `shortBio` or `Project.caseStudyBody` as required.

## Shared fields on collection items

Projects, skills, socials, experience, education and certifications all have:

| Field | Type | Default | Meaning |
| :--- | :--- | :--- | :--- |
| `owner` | ObjectId | required | Owning account |
| `visibility` | `draft` \| `published` | `draft` | Only `published` items are served by `/v1` |
| `order` | Number | next position | Manual sort position |
| `featured` | Boolean | varies | Used by an App section in `featured` mode |
| `createdAt`, `updatedAt` | Date | automatic | |

URL fields must be `https://` (socials also accept `mailto:`), at most 2048 characters, with no embedded credentials.

## Field caps

Every string has a `maxlength` and every array a maximum length and a per-item cap, so one tenant is bounded to a few MB. Over a cap the dashboard API answers `400` with `fields`.

| Model | Caps |
| :--- | :--- |
| Profile | `name` 120, `initials` 4, `headline` 160, `shortBio` 500, `aboutMarkdown` 20,000, `email` 254, `location.city` / `country` 80, `statusText` 200, `terminalUser` / `terminalHost` 32, `bootGreeting` 500, `metrics` ≤ 8 × (`label` 40, `value` 40, `description` 200) |
| Resume | `fileName` 120, `version` 40, `summaryText` 500 |
| Project | `title` 120, `slug` 80 matching `^[a-z0-9]+(-[a-z0-9]+)*$`, `role` 80, `shortDescription` 500, `keyMetric` 120, `caseStudyBody` 20,000, `highlights` ≤ 15 × 200, `stack` ≤ 30 × 40, `teammates` ≤ 20 × 80 |
| Skill | `name` 120, `category` 60 |
| Social | `platform` 120, `label` 500, `username` 80, `icon` 40 |
| Experience | `company` / `role` 120, `period` 60, `location` 120, `description` 2,000, `achievements` ≤ 15 × 300, `technologies` ≤ 30 × 40 |
| Education | `institution` / `degree` 120, `fieldOfStudy` 120, `period` 60, `grade` 40, `location` 120, `achievements` ≤ 15 × 300 |
| Certification | `title` / `issuer` 120, `issueDate` / `expirationDate` 32, `credentialId` 120, `skills` ≤ 30 × 40 |
| App `include` | `fields` ≤ the public field list for that model, unique; `ids` ≤ 100, unique; `categories` ≤ 50 × 60, unique |

Items per section: 100. Apps per account: 10. Live keys per App: 2.

## Content

### Profile

One per account, unique on `owner`. **Not created on read**: `GET /api/profile` returns an unsaved blank object with `configured: false` until the first `PUT /api/profile` (or availability patch) upserts it with `configured: true`. `/v1/profile` answers `404 not_configured` until then.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `configured` | Boolean | `false`; set to `true` by the first save |
| `name` | String | 120, `''` |
| `initials` | String | 4, `''` |
| `headline` | String | 160, `''` |
| `shortBio` | String | 500, `''` |
| `aboutMarkdown` | String (Markdown) | 20,000, `''` |
| `email` | String | 254, `''`. A profile save that includes an email creates or updates an "Email" social link as a **draft** (`featured: false`) so a private address is never published by accident; clearing the email removes the link. |
| `phone` | String | `''`. Never served by `/v1`. |
| `location` | `{ city, country, isRemoteAvailable }` | 80 / 80 / `false` |
| `statusText` | String | 200, `''` |
| `isAvailableForHire` | Boolean | `false` |
| `terminalUser`, `terminalHost`, `bootGreeting` | String | 32 / 32 / 500, `''`. For terminal-style sites |
| `metrics` | Array of `{ label, value, description }` | ≤ 8, `[]` |

### Resume

At most one per account, unique on `owner`. `/v1/resume` answers `404 not_configured` while none exists.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `resumeUrl` | String, required, https | |
| `fileName` | String | 120, `''` |
| `version` | String | 40, `''` |
| `lastUpdated` | Date | set on save |
| `summaryText` | String | 500, `''` |

`driveUrl` is a virtual alias of `resumeUrl`.

### Project

Unique on `{ owner, slug }`.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `title` | String, required | 120 |
| `slug` | String, required, lowercase | 80, `^[a-z0-9]+(-[a-z0-9]+)*$`; generated from the title on create, **never changed by a title edit**; changing it later requires sending `slug` explicitly (`409` on collision) |
| `mode` | `solo` \| `team` | `solo` |
| `role` | String | 80, `''` |
| `shortDescription` | String, required | 500 |
| `keyMetric` | String | 120, `''` |
| `highlights`, `stack`, `teammates` | Array of String | ≤ 15 × 200, ≤ 30 × 40, ≤ 20 × 80 |
| `caseStudyBody` | String (Markdown) | 20,000, `''` (no longer required) |
| `thumbnail` | String, https | |
| `links` | `{ github, live, demo }`, https | |
| `featured` | Boolean | `true` |
| `lastUpdated` | Date | set on update |

### Skill

Unique on `{ owner, name }`, case-insensitive.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `name` | String, required | 120 |
| `category` | String, required, trimmed | 60. **Free text per tenant.** The seven former names (`Languages`, `Frontend`, `Backend & Systems`, `Databases & Caching`, `DevOps & Cloud`, `Hardware & Electronics`, `Tools & Frameworks`) are only suggestions; `GET /api/skills/categories` returns the tenant's own distinct values (merged with the suggestions while they have none), and an App's `include.skills.categories` is validated against that list. |
| `proficiency` | Enum | `Beginner`, `Familiar`, `Proficient`, `Advanced`, `Expert`. Default `Proficient`. |
| `yearsOfExperience` | Number, 0 or more | `1` |
| `featured` | Boolean | `false` |

### Social

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `platform` | String, required | 120 |
| `label` | String, required | 500 |
| `url` | String, required, https or `mailto:` | |
| `username` | String | 80 |
| `icon` | String | 40, `link` |
| `featured` | Boolean | `true` |

### Experience

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `company`, `role` | String, required | 120 each |
| `employmentType` | Enum | `Full-time`, `Part-time`, `Internship`, `Contract`, `Freelance`. Default `Full-time`. |
| `period` | String, required | 60. Display text, e.g. `June 2024 - Present` |
| `startDate`, `endDate` | Date | optional |
| `isCurrent` | Boolean | `false` |
| `location` | String | 120, `''` |
| `companyUrl` | String, https | |
| `description` | String, required | 2,000 |
| `achievements`, `technologies` | Array of String | ≤ 15 × 300, ≤ 30 × 40 |
| `featured` | Boolean | `true` |

### Education

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `institution`, `degree` | String, required | 120 each |
| `fieldOfStudy` | String | 120, `''` |
| `period` | String, required | 60. Display text |
| `startDate`, `endDate` | Date | optional |
| `grade`, `location` | String | 40, 120 |
| `achievements` | Array of String | ≤ 15 × 300 |
| `featured` | Boolean | `false` |

### Certification

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `title`, `issuer` | String, required | 120 each |
| `issueDate` | String, required | 32. Free text or an ISO date |
| `expirationDate` | String | 32, `''` |
| `credentialId` | String | 120 |
| `credentialUrl` | String, https | |
| `skills` | Array of String | ≤ 30 × 40 |
| `featured` | Boolean | `false` |

## Access control

### App

| Field | Type | Notes |
| :--- | :--- | :--- |
| `name` | String, required | 80 |
| `type` | `static` \| `protected` | `static` issues publishable `pk_` keys (browsers, origin-checked); `protected` issues secret `sk_` keys (builds and servers). Changing the type revokes the other kind of key. |
| `allowedOrigins` | Array of String | Up to 10 https origins, or `*` |
| `include` | Object | One entry per section; see below |
| `quotaSlot` | Number 0 to 9 | Internal; a unique `{ owner, quotaSlot }` index enforces the 10-App limit |

`include` entries:

| Section | Settings |
| :--- | :--- |
| `profile`, `resume` | `enabled`, `fields` |
| `socials`, `projects`, `experience`, `education`, `certifications` | `enabled`, `mode` (`all`, `featured`, `selected`), `ids`, `fields` |
| `skills` | the above plus `categories` (validated against the tenant's own categories) |
| `fs` | `enabled` |

`fields` may only name fields from the public list for that section (`PUBLIC_FIELDS` in `server/lib/modelConstants.js`); `_id` is always included. An empty `fields` means the defaults (`DEFAULT_FIELDS`). Deleting an item removes its id from every App that had it `selected`; on save, stale stored ids are dropped silently, but a newly sent id the tenant does not own is still a `400`.

### ApiToken

| Field | Type | Notes |
| :--- | :--- | :--- |
| `app` | ObjectId | The App it reads as |
| `type` | `pk` \| `sk` | |
| `prefix` | String | First 12 characters, for display |
| `hash` | String, unique | SHA-256 of the key; used for lookup and held in the in-memory active-token set |
| `value` | String | The full key, stored for `pk` only; always `null` for `sk` |
| `label` | String | 60 |
| `expiresAt` | Date or null | |
| `expiryWarningSentAt` | Date or null | Set when the expiry reminder email has been sent |
| `lastUsedAt` | Date or null | Updated (throttled, owner-scoped) on use |
| `revokedAt` | Date or null | |
| `quotaSlot` | 0 or 1 | Internal; a partial unique index allows two active keys per App |

Key format: `pk_live_` or `sk_live_` followed by 43 base-62 characters (256 random bits). A post-save hook keeps the active-token set current.

## Accounts and platform

### User

| Field | Type | Notes |
| :--- | :--- | :--- |
| `email` | String, unique, lowercase | |
| `passwordHash` | String or **null** | bcrypt, cost 10. `null` from email-first signup until the verify page sets the password; login refuses `null`. |
| `emailVerifiedAt` | Date or null | Writes are blocked until set. Accounts still `null` after 48 hours are purged by the sweep. |
| `acceptedTermsAt`, `acceptedTermsVersion` | Date, String | Consent recorded at signup; the version is `TERMS_VERSION` from `server/lib/legal.js` at that moment |
| `acceptedPrivacyAt`, `acceptedPrivacyVersion` | Date, String | Same for the privacy policy (`PRIVACY_VERSION`) |
| `tokenVersion` | Number | Embedded in each session; incrementing it ends all sessions |
| `status` | `active` \| `suspended` \| `deleted` | `suspended` (superadmin action) ends sessions and makes every key answer `401 account_unavailable`, content kept; `deleted` starts the cascade |
| `role` | `user` \| `superadmin` | Set only by scripts |
| `encDEK` | String or null | Reserved; unused (field encryption was cut) |

### EmailToken

`user`, `type` (`verify` lasts 24 hours, `reset` lasts 1 hour), `hash` (SHA-256 of a 256-bit token), `expiresAt` (TTL index), `usedAt`. Consuming a token invalidates the other unused ones of that type; issuing a new one does not, so an older reset link still works if the newer mail is late.

### Invite

`codeHash` (HMAC-SHA-256 of the 12-character base32 code, keyed by `INVITE_CODE_PEPPER` or `JWT_SECRET`), `createdBy`, `usedBy` (the last account to use it; cleared if that account is deleted), `usedCount`, `maxUses` (1 to 50), `expiresAt` (TTL index). Legacy 6-digit codes are accepted until they expire; none are created.

### Setting

`key`, `value`, `updatedBy`. Keys in use: `signupMode` (`closed` | `invite` | `open`) and `mail:YYYY-MM-DD` (the day's outbound-mail counter, incremented atomically against `MAIL_DAILY_CAP`).

## Deleting an account

`DELETE /api/account` (password re-auth) and the superadmin's `DELETE /api/admin/users/:id` mark the user `deleted` (which immediately ends its sessions and keys), then remove its keys, Apps and content, its email tokens, and finally the user. If that is interrupted, the server's periodic sweep (`SWEEP_DELETED_INTERVAL_HOURS`) or `npm run sweep:deleted` finishes it. Backups keep the data for at most `BACKUP_RETENTION_DAYS` (30) days.
