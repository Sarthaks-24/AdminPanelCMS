# Quickstart

From an empty account to your own content arriving in your build, in about ten minutes. No card.

Every request goes to `{{API_BASE}}`, and every endpoint below hangs off it under `/v1`, for example `{{API_BASE}}/v1/projects`.

## 1. Create an account and verify your email

1. Open [Create a free account](/signup) and enter your email. While registration is invite-only you also enter the code from your invite email.
2. We send a verification link. It expires in 24 hours.
3. Open the link, **choose a password** (at least 10 characters), and you are signed in.

Signing in later is at [/login](/login). If you never open the link, the unverified account is removed after 48 hours and you can sign up again.

## 2. Add your profile and one project

1. **Profile**: your name, headline and a short bio are enough to start. Save it. The profile becomes readable the moment it is saved; until then the API answers `404 not_configured` for it.
2. **Projects → New project**: a title, a one-line summary and (optionally) a Markdown case study. Click **Save and publish**.

Everything you create is published as you save unless you choose **Save as draft**. A draft is invisible to every App, however generous its grant.

## 3. Create an App and choose what it can read

An **App** is one scoped, read-only view of your content: one per site you build.

1. **Apps → New App**. Name it after the site (`portfolio-site`).
2. **What will this App read?** Keep **Everything published**. It enables every section with its default fields. You can narrow it to specific sections, items and fields later.
3. **Where will you fetch from?** Keep **Build or server (recommended)**. This App will use a secret key that never ships to a browser.
4. Create it. You land in the App's **Connect** panel.

## 4. Create a secret key

In the Connect panel, click **Create secret key**. Copy it now: a secret key is shown once and never again. Keys look like `sk_live_` followed by 43 characters.

Store it in your build's environment as `CONTENT_API_KEY`.

> **Name the variable `CONTENT_API_KEY`. Never prefix it with `PUBLIC_`, `NEXT_PUBLIC_` or `VITE_`.** Those prefixes copy the value into the JavaScript your visitors download, which turns your secret key into a public one. Import it only in build or server code. Pull requests from forks don't receive secrets, so a fork's preview build will fail to fetch, which is the correct outcome.

## 5. Fetch from your build

Fetch each list once per build and build your pages from it. The lists are small, and one request per section is all a build needs.

### curl

```bash
curl -H "Authorization: Bearer $CONTENT_API_KEY" {{API_BASE}}/v1/projects
```

### Astro

```astro
---
// Runs at build time; the secret key never reaches a browser.
const res = await fetch('{{API_BASE}}/v1/projects', {
  headers: { Authorization: `Bearer ${import.meta.env.CONTENT_API_KEY}` },
});
if (!res.ok) throw new Error(`Content API ${res.status}: ${(await res.json()).error}`);
const { data: projects } = await res.json();
---
<ul>
  {projects.map((project) => <li><a href={`/work/${project.slug}`}>{project.title}</a></li>)}
</ul>
```

### Next.js

```js
// app/work/page.js — a server component. Revalidates every 5 minutes.
export default async function Work() {
  const res = await fetch('{{API_BASE}}/v1/projects', {
    headers: { Authorization: `Bearer ${process.env.CONTENT_API_KEY}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Content API ${res.status}: ${(await res.json()).error}`);
  const { data: projects } = await res.json();
  return <ul>{projects.map((project) => <li key={project._id}>{project.title}</li>)}</ul>;
}
```

Every successful response is `{ "data": … }`: an array for a list, an object for `/profile`, `/resume` and `/projects/:slug`. Every error is `{ "error": "<code>", "message": "…", "requestId": "…" }`. The full list is in [Limits & errors](LIMITS_AND_ERRORS.md).

## 6. Confirm it arrived

Back in the App's Connect panel, the line **"Waiting for your key to reach us…"** flips to **"Your key reached us"** within a few seconds of your first request. It records that your key was accepted at `{{API_BASE}}/v1`; whether the request then got `200` or an error is in the response you received.

Two notes:

- Activity is recorded at most once a minute per key, so a second request inside that minute won't move the timestamp.
- **Check this App** in the same panel lists each section with its published and draft counts and the fields it serves, so an empty `[]` or a `403` is explained without guessing.

## What next

- **Narrow a grant.** Open the App and untick sections or fields. An empty field list means "this section's defaults"; to serve nothing from a section, turn the section off.
- **A second site.** Create a second App. It reads from the same content, with its own grant and its own key. Edit your bio once and both sites read it: a site that fetches in the browser sees it within about a minute; a site that fetches at build time sees it on its next build (trigger one from your host, or use `revalidate` as in the Next.js example).
- **A site that fetches in the browser.** Create an App with **Visitors' browsers**, add the site's `https://` origin, and use its publishable key (`pk_live_…`). Anyone can copy that key from your page, so the App's grant is the only thing protecting your content, and the key's limit (120 requests a minute per visitor) is shared by all of them. For real traffic, fetch at build time.
- **A terminal-style site.** Enable the **Filesystem view** on an App and read `{{API_BASE}}/v1/fs`: the same granted content as a tree of files.

The [API reference](API_REFERENCE.md) has every endpoint and query parameter; [Content fields](CONTENT_FIELDS.md) lists what each section can serve.
