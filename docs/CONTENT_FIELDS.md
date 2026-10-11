# Content fields

What each section can serve, what it serves by default, and what it never serves. An App's field list can only ever name fields from the **public** column; everything else stays in the dashboard.

## The envelope

Every successful `/v1` response wraps its payload in `data`:

```json
{ "data": [ { "_id": "6710a1f2c9e4b2a7d3f01234", "title": "Realtime Board", "slug": "realtime-board" } ] }
```

- Lists (`/v1/projects`, `/v1/skills`, …) are arrays inside `data`.
- Singletons (`/v1/profile`, `/v1/resume`, `/v1/projects/:slug`) are one object inside `data`.
- `/v1/skills/categories` is an object inside `data`, keyed by category name.
- `/v1/app` and `/v1/fs` are objects inside `data`.

`_id` is always included on every item. Dotted fields (`location.city`, `links.github`) come back as nested objects: `{ "location": { "city": "Göteborg" } }`.

## How an App's field list works

Each section of an App has a `fields` list.

| The list is | The API serves |
| :--- | :--- |
| empty (the default) | the section's **default** fields below |
| some field names | exactly those fields, plus `_id` |

- Names outside the public column are refused when the App is saved (`400 validation_failed`). The API never serves them regardless.
- To serve **nothing** from a section, turn the section off. An empty list is not "nothing", it is "the defaults".
- The **opt-in** fields are public but not in the defaults: an App serves them only when its list names them. They are the fields most likely to be private (your email, your résumé's storage link, teammates' names), so you grant them App by App.

The dashboard's App editor is a checklist over the same columns.

## Fields by section

### Profile (`/v1/profile`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `name` | yes | |
| `initials` | yes | up to 4 characters |
| `headline` | yes | up to 160 characters |
| `shortBio` | yes | |
| `aboutMarkdown` | yes | Markdown, served as written. Sanitise what you render from it. |
| `email` | **opt-in** | |
| `location.city` | yes | |
| `location.country` | yes | |
| `location.isRemoteAvailable` | yes | boolean |
| `statusText` | yes | up to 200 characters |
| `isAvailableForHire` | yes | boolean |
| `terminalUser` | yes | for terminal-style sites |
| `terminalHost` | yes | for terminal-style sites |
| `bootGreeting` | yes | for terminal-style sites |
| `metrics` | yes | up to 8 of `{ label, value, description }` |

`/v1/profile` answers `404 not_configured` until the profile has been saved once.

### Resume (`/v1/resume`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `resumeUrl` | yes | the public link to your résumé |
| `driveUrl` | **opt-in** | a second, usually private, link; falls back to `resumeUrl` when empty |
| `fileName` | yes | |
| `version` | yes | |
| `lastUpdated` | yes | ISO date |
| `summaryText` | yes | |

`/v1/resume` answers `404 not_configured` until a résumé link has been added.

### Projects (`/v1/projects`, `/v1/projects/:slug`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `title` | yes | |
| `slug` | yes | lowercase letters, digits and single hyphens, up to 80 characters; unique within your account |
| `mode` | yes | `solo` or `team` |
| `role` | yes | |
| `shortDescription` | yes | |
| `keyMetric` | yes | |
| `highlights` | yes | array of strings, up to 15 |
| `caseStudyBody` | yes | Markdown, up to 20,000 characters, served as written |
| `stack` | yes | array of strings, up to 30; the `?stack=` filter matches these |
| `teammates` | **opt-in** | array of strings, up to 20 |
| `thumbnail` | yes | `https://` URL |
| `links.github` | yes | `https://` URL |
| `links.live` | yes | `https://` URL |
| `links.demo` | yes | `https://` URL |
| `order` | yes | number; lists are sorted by it |
| `featured` | yes | boolean; the `?featured=true` filter and the App's `featured` mode use it |
| `lastUpdated` | **opt-in** | ISO date |

### Skills (`/v1/skills`, `/v1/skills/categories`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `name` | yes | |
| `category` | yes | your own category names, up to 60 characters each; the `?category=` filter matches them case-insensitively |
| `proficiency` | yes | one of `Beginner`, `Familiar`, `Proficient`, `Advanced`, `Expert` |
| `yearsOfExperience` | yes | number |
| `featured` | yes | boolean |
| `order` | yes | number |

An App can also restrict the skills section to chosen categories.

### Socials (`/v1/socials`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `platform` | yes | |
| `label` | yes | |
| `url` | yes | |
| `username` | yes | |
| `icon` | yes | a name for your icon set to resolve |
| `order` | yes | number |
| `featured` | yes | boolean |

### Experience (`/v1/experience`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `company` | yes | |
| `role` | yes | |
| `employmentType` | yes | |
| `period` | yes | free text, e.g. `2021 – present` |
| `startDate` | yes | ISO date |
| `endDate` | yes | ISO date, empty while `isCurrent` |
| `isCurrent` | yes | boolean |
| `location` | yes | |
| `companyUrl` | yes | `https://` URL |
| `description` | yes | up to 2,000 characters |
| `achievements` | yes | array of strings, up to 15 |
| `technologies` | yes | array of strings, up to 30 |
| `order` | yes | number |
| `featured` | yes | boolean |

### Education (`/v1/education`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `institution` | yes | |
| `degree` | yes | |
| `fieldOfStudy` | yes | |
| `period` | yes | free text |
| `startDate` | yes | ISO date |
| `endDate` | yes | ISO date |
| `grade` | yes | |
| `location` | yes | |
| `achievements` | yes | array of strings, up to 15 |
| `order` | yes | number |
| `featured` | yes | boolean |

### Certifications (`/v1/certifications`)

| Field | Default | Notes |
| :--- | :---: | :--- |
| `title` | yes | |
| `issuer` | yes | |
| `issueDate` | yes | string; lists are sorted by it, newest first |
| `expirationDate` | yes | string |
| `credentialId` | yes | |
| `credentialUrl` | yes | `https://` URL |
| `skills` | yes | array of strings, up to 30 |
| `order` | yes | number |
| `featured` | yes | boolean |

## Never served

These exist in the dashboard and are never served by `/v1`, whatever an App's field list says:

| Field | Why |
| :--- | :--- |
| `phone` (profile) | private contact detail; no App can expose it |
| `owner` | the account id |
| `visibility` | every served item is `published` by definition |
| `createdAt`, `updatedAt` | internal timestamps |
| `password`, keys, session data | account security |

Draft items are never served either, by any endpoint, including `/v1/fs`.

## Field caps

Limits enforced when you save. Longer values are refused with `400 validation_error` in the dashboard.

| Section | Caps |
| :--- | :--- |
| Profile | `initials` 4 · `headline` 160 · `shortBio` 500 · `aboutMarkdown` 20,000 · `location.city`/`country` 80 · `statusText` 200 · `terminalUser`/`terminalHost` 32 · `bootGreeting` 500 · `email` 254 · `metrics` ≤ 8 (label/value 40, description 200) |
| Project | `title` 120 · `slug` 80 · `role` 80 · `shortDescription` 500 · `keyMetric` 120 · `caseStudyBody` 20,000 · `highlights` ≤ 15 × 200 · `stack` ≤ 30 × 40 · `teammates` ≤ 20 × 80 |
| Skill | `name` 120 · `category` 60 |
| Social | `username` 80 · `icon` 40 |
| Experience | `period` 60 · `location` 120 · `description` 2,000 · `achievements` ≤ 15 × 300 · `technologies` ≤ 30 × 40 |
| Education | `fieldOfStudy` 120 · `period` 60 · `grade` 40 · `location` 120 · `achievements` ≤ 15 × 300 |
| Certification | `issueDate`/`expirationDate` 32 · `credentialId` 120 · `skills` ≤ 30 × 40 |
| Resume | `fileName` 120 · `version` 40 |
| App | `fields` ≤ the section's public count, unique · `ids` ≤ 100, unique · skill `categories` ≤ 50 × 60, unique |

Every section holds at most 100 items.
