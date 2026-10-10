# Data model

MongoDB collections, as defined by the Mongoose schemas in `server/models/`. The schemas are the source of truth; this page summarises them.

## Overview

| Collection | Model | Per account | Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `User` | | Accounts and credentials |
| `profiles` | `Profile` | at most one (created on first read) | Name, bio, contact, availability |
| `resumes` | `Resume` | at most one | Link to the resume file |
| `projects` | `Project` | up to 100 | Case studies |
| `skills` | `Skill` | up to 100 | Skills in fixed categories |
| `socials` | `Social` | up to 100 | External links |
| `experiences` | `Experience` | up to 100 | Work history |
| `educations` | `Education` | up to 100 | Education |
| `certifications` | `Certification` | up to 100 | Certifications |
| `apps` | `App` | up to 10 | What each consumer may read |
| `apitokens` | `ApiToken` | 2 active per App | `/v1` credentials |
| `emailtokens` | `EmailToken` | | Verification and reset links |
| `invites` | `Invite` | | Signup invite codes |
| `settings` | `Setting` | | Platform settings (signup mode) |

## Ownership

Every content document, App and API token has an `owner` field: a required reference to a `User`, immutable on content and Apps.

The `ownerGuard` plugin (`server/plugins/ownerGuard.js`) is applied to all of those schemas. It throws if a query, update, delete or count runs without a concrete `owner` ObjectId in its filter, if an aggregation does not start by matching on `owner`, or if a bulk insert lacks one. The single exemption is the API-token lookup by hash, which is how a token is authenticated before its owner is known. Bulk writes go through `scopedBulkWrite`, which checks each operation. `npm run lint:security` statically rejects code that would bypass the guard.

`User`, `EmailToken`, `Invite` and `Setting` are platform records, not tenant content, and are not guarded.

## Shared fields on collection items

Projects, skills, socials, experience, education and certifications all have:

| Field | Type | Default | Meaning |
| :--- | :--- | :--- | :--- |
| `owner` | ObjectId | required | Owning account |
| `visibility` | `draft` \| `published` | `draft` | Only `published` items are served by `/v1` |
| `order` | Number | next position (skills: `0`) | Manual sort position |
| `featured` | Boolean | varies | Used by an App section in `featured` mode |
| `createdAt`, `updatedAt` | Date | automatic | |

URL fields must be `https://` (socials also accept `mailto:`), at most 2048 characters, with no embedded credentials.

## Content

### Profile

One per account, unique on `owner`. Created with placeholder defaults on first read.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `name` | String, required | 120 |
| `initials` | String | `PA` |
| `headline` | String, required | 120 |
| `shortBio` | String, required | 500 |
| `aboutMarkdown` | String (Markdown) | 20,000 |
| `email` | String | empty. Every profile save that includes an email creates or updates an "Email" social link (published when first created, always marked featured). Clearing the email does not remove the link. |
| `phone` | String | empty. Never served by `/v1`. |
| `location` | `{ city, country, isRemoteAvailable }` | |
| `statusText` | String | |
| `isAvailableForHire` | Boolean | `true` |
| `terminalUser`, `terminalHost`, `bootGreeting` | String | For terminal-style sites |
| `metrics` | Array of `{ label, value, description }` | |

### Resume

At most one per account, unique on `owner`.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `resumeUrl` | String, required, https | |
| `fileName` | String | `Resume_Master.pdf` |
| `version` | String | `v2026.09` |
| `lastUpdated` | Date | set on save |
| `summaryText` | String | 500; has a placeholder default, so set it before exposing the resume section |

`driveUrl` is a virtual alias of `resumeUrl`.

### Project

Unique on `{ owner, slug }`.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `title` | String, required | 120 |
| `slug` | String, required, lowercase | 120; generated from the title if omitted |
| `mode` | `solo` \| `team` | `solo` |
| `role` | String | `Lead Engineer` |
| `shortDescription` | String, required | 500 |
| `keyMetric` | String | |
| `highlights`, `stack`, `teammates` | Array of String | |
| `caseStudyBody` | String (Markdown), required | 20,000 |
| `thumbnail` | String, https | |
| `links` | `{ github, live, demo }`, https | |
| `featured` | Boolean | `true` |
| `lastUpdated` | Date | set on update |

### Skill

Unique on `{ owner, name }`, case-insensitive.

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `name` | String, required | 120 |
| `category` | Enum, required | `Languages`, `Frontend`, `Backend & Systems`, `Databases & Caching`, `DevOps & Cloud`, `Hardware & Electronics`, `Tools & Frameworks`. Default `Backend & Systems`. |
| `proficiency` | Enum | `Beginner`, `Familiar`, `Proficient`, `Advanced`, `Expert`. Default `Proficient`. |
| `yearsOfExperience` | Number, 0 or more | `1` |
| `featured` | Boolean | `false` |

### Social

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `platform` | String, required | 120 |
| `label` | String, required | 500 |
| `url` | String, required, https or `mailto:` | |
| `username` | String | |
| `icon` | String | `link` |
| `featured` | Boolean | `true` |

### Experience

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `company`, `role` | String, required | 120 each |
| `employmentType` | Enum | `Full-time`, `Part-time`, `Internship`, `Contract`, `Freelance`. Default `Full-time`. |
| `period` | String, required | Display text, e.g. `June 2024 - Present` |
| `startDate`, `endDate` | Date | optional |
| `isCurrent` | Boolean | `false` |
| `location` | String | `Remote` |
| `companyUrl` | String, https | |
| `description` | String, required | 500 |
| `achievements`, `technologies` | Array of String | |
| `featured` | Boolean | `true` |

### Education

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `institution`, `degree` | String, required | 120 each |
| `fieldOfStudy` | String | `Computer Science & Engineering` |
| `period` | String, required | Display text |
| `startDate`, `endDate` | Date | optional |
| `grade`, `location` | String | |
| `achievements` | Array of String | |
| `featured` | Boolean | `false` |

### Certification

| Field | Type | Limit / default |
| :--- | :--- | :--- |
| `title`, `issuer` | String, required | 120 each |
| `issueDate` | String, required | Free text or an ISO date |
| `expirationDate` | String | `No Expiration` |
| `credentialId` | String | |
| `credentialUrl` | String, https | |
| `skills` | Array of String | |
| `featured` | Boolean | `false` |

String-array fields (`highlights`, `stack`, `teammates`, `achievements`, `technologies`, `skills`) and several plain strings (a project's `role` and `keyMetric`, and `period`, `location`, `grade`) currently have no length cap.

## Access control

### App

| Field | Type | Notes |
| :--- | :--- | :--- |
| `name` | String, required | 80 |
| `type` | `static` \| `protected` | Decides which token type the App issues |
| `allowedOrigins` | Array of String | Up to 10 https origins, or `*` |
| `include` | Object | One entry per section; see below |
| `quotaSlot` | Number 0 to 9 | Internal; a unique `{ owner, quotaSlot }` index enforces the 10-App limit |

`include` entries:

| Section | Settings |
| :--- | :--- |
| `profile`, `resume` | `enabled`, `fields` |
| `socials`, `projects`, `experience`, `education`, `certifications` | `enabled`, `mode` (`all`, `featured`, `selected`), `ids`, `fields` |
| `skills` | the above plus `categories` |
| `fs` | `enabled` |

`fields` may only name fields from the public list for that section (`PUBLIC_FIELDS` in `server/lib/modelConstants.js`). An empty `fields` means the defaults (`DEFAULT_FIELDS`).

### ApiToken

| Field | Type | Notes |
| :--- | :--- | :--- |
| `app` | ObjectId | The App it reads as |
| `type` | `pk` \| `sk` | |
| `prefix` | String | First 12 characters, for display |
| `hash` | String, unique | SHA-256 of the token; used for lookup |
| `value` | String | The full token, stored for `pk` only; always `null` for `sk` |
| `label` | String | 60 |
| `expiresAt` | Date or null | |
| `expiryWarningSentAt` | Date or null | Set when the expiry reminder email has been sent |
| `lastUsedAt` | Date or null | |
| `revokedAt` | Date or null | |
| `quotaSlot` | 0 or 1 | Internal; a partial unique index allows two active tokens per App |

Token format: `pk_live_` or `sk_live_` followed by 43 base-62 characters (256 random bits).

## Accounts and platform

### User

| Field | Type | Notes |
| :--- | :--- | :--- |
| `email` | String, unique, lowercase | |
| `passwordHash` | String | bcrypt, cost 10 |
| `emailVerifiedAt` | Date or null | Writes are blocked until set |
| `acceptedTermsAt` | Date or null | |
| `tokenVersion` | Number | Embedded in each session; incrementing it ends all sessions |
| `status` | `active` \| `deleted` | |
| `role` | `user` \| `superadmin` | Set only by scripts |
| `encDEK` | String or null | Reserved; unused |

### EmailToken

`user`, `type` (`verify` lasts 24 hours, `reset` lasts 1 hour), `hash` (SHA-256 of a 256-bit token), `expiresAt` (TTL index), `usedAt`. Issuing a new token of a type invalidates the previous unused ones.

### Invite

`codeHash` (HMAC-SHA-256 of the six-digit code, keyed by `INVITE_CODE_PEPPER` or `JWT_SECRET`), `createdBy`, `usedBy` (the last account to use it; cleared if that account is deleted), `usedCount`, `maxUses` (1 to 1000), `expiresAt` (TTL index).

### Setting

`key`, `value`, `updatedBy`. Currently holds one key, `signupMode`.

## Deleting an account

`DELETE /api/account` marks the user `deleted` (which immediately ends its sessions and tokens), then removes its tokens, Apps and content, its email tokens, and finally the user. If that is interrupted, the server's periodic sweep (`SWEEP_DELETED_INTERVAL_HOURS`) or `npm run sweep:deleted` finishes it.
