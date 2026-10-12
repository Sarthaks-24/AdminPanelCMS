/**
 * The 10-minute path, end to end: landing → signup → verify → profile → project → App → key → first /v1 call.
 *
 * PLAYWRIGHT IS NOT INSTALLED YET (contract §6: no install in this pass). To run it:
 *
 *   cd client
 *   npm i -D @playwright/test && npx playwright install chromium
 *   # add to package.json scripts:  "e2e": "playwright test e2e"
 *   E2E_BASE_URL=http://localhost:5173 E2E_API_URL=http://localhost:5000/api npx playwright test e2e/first-call.spec.ts
 *
 * Both servers must be running (`npm run dev` in server/ with MODE=dev and open signup, `npm run dev` in client/).
 *
 * Email verification is the one step a browser can't do alone. Two ways through it:
 *   1. E2E_EMAIL + E2E_PASSWORD: an already-verified account; the signup/verify steps are skipped and the
 *      test signs in directly. Simplest for a staging run.
 *   2. E2E_VERIFY_TOKEN_URL: a dev-only endpoint (NOT part of the product; the integrator wires it behind
 *      MODE=dev) that returns `{ token }` for `?email=`. The test calls it after signup and opens
 *      /verify-email?token=… itself. Until it exists the signup branch is skipped with a clear message.
 *
 * Runs once per theme in THEMES (powershell, clean-studio, and hc-light since the 2026-10-12 theme council). No screenshots are
 * compared; the assertion is a 200 with `{ data: [...] }` from the public API using the key the UI minted.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const THEMES = ['powershell', 'clean-studio', 'hc-light'] as const;

const PASSWORD = process.env.E2E_PASSWORD ?? 'correct-horse-battery-staple';
const EXISTING_EMAIL = process.env.E2E_EMAIL;
const VERIFY_TOKEN_URL = process.env.E2E_VERIFY_TOKEN_URL;

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signIn(page: Page, email: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signUpAndVerify(page: Page, email: string) {
  // 0:00 landing: the CTA must be visible before any config call settles.
  await page.goto(`${BASE_URL}/`);
  const cta = page.getByRole('link', { name: /create a free account|request an invite/i }).first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/\/signup/);

  // 0:45 signup (email-first: no password here).
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('checkbox', { name: /terms/i }).check();
  await page.getByRole('checkbox', { name: /privacy/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();

  // 1:30 check-email echoes the address.
  await expect(page).toHaveURL(/\/check-email/);
  await expect(page.getByText(email)).toBeVisible();

  // 2:30 verify (stub) → set password → signed in.
  const res = await page.request.get(`${VERIFY_TOKEN_URL}?email=${encodeURIComponent(email)}`);
  expect(res.ok(), 'verify-token stub answered').toBeTruthy();
  const { token } = await res.json();
  await page.goto(`${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /set password|verify|continue/i }).click();
  await expect(page.getByText(/verified/i)).toBeVisible();
  await signIn(page, email);
}

for (const theme of THEMES) {
  test.describe(`first call on ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      // The pre-paint script in index.html reads this key; storing it first means no flash of the default theme.
      await page.addInitScript((id) => { try { localStorage.setItem('pc_theme', id); } catch { /* blocked storage is fine */ } }, theme);
    });

    test('landing → signup → profile → project → App preset → key → GET /v1/projects returns { data: [...] }', async ({ page }) => {
      test.setTimeout(10 * 60 * 1000);
      test.skip(!EXISTING_EMAIL && !VERIFY_TOKEN_URL, 'Set E2E_EMAIL + E2E_PASSWORD (verified account) or E2E_VERIFY_TOKEN_URL (dev stub) to run the funnel.');

      const email = EXISTING_EMAIL ?? freshEmail();
      if (EXISTING_EMAIL) await signIn(page, email);
      else await signUpAndVerify(page, email);

      // The dashboard shows the 5-step checklist and no verify banner.
      await expect(page.getByRole('heading', { name: /from sign-up to your first request/i })).toBeVisible();
      await expect(page.getByText(/verify your email/i)).toHaveCount(0);

      // 3:00 profile. Every field is reachable by its label.
      await page.goto(`${BASE_URL}/dashboard/profile`);
      await page.getByLabel(/^name/i).fill('Ada Example');
      await page.getByLabel(/headline/i).fill('Engineer who ships');
      await page.getByLabel(/public email/i).fill(email);
      await page.getByLabel(/short bio/i).fill('I build things and write about them.');
      await page.getByRole('button', { name: /save profile/i }).first().click();
      await expect(page.getByRole('status')).toContainText(/saved/i);

      // One project, published on save.
      await page.goto(`${BASE_URL}/dashboard/projects/new`);
      const title = `E2E project ${Date.now()}`;
      await page.getByLabel(/^title/i).fill(title);
      await page.getByLabel(/short summary/i).fill('A project created by the first-call test.');
      await page.getByRole('button', { name: /save and publish/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/projects$/);
      await expect(page.getByText(title)).toBeVisible();

      // 6:00 App with the default preset (Everything published) and the default type (Build or server).
      await page.goto(`${BASE_URL}/dashboard/apps`);
      await page.getByLabel(/^name/i).fill(`e2e-${theme}`);
      await expect(page.getByRole('radio', { name: /everything published/i })).toBeChecked();
      await expect(page.getByRole('radio', { name: /build or server/i })).toBeChecked();
      await page.getByRole('button', { name: /create app/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/apps\/[0-9a-f]{24}/);

      // 6:45 Connect panel: the base URL is printed and ends in /v1; Check this App finds nothing in the way of projects.
      const region = page.getByRole('region', { name: /connect this app/i });
      const baseUrl = (await region.locator('code').first().textContent())?.trim();
      expect(baseUrl, 'base URL rendered').toMatch(/\/v1$/);
      await region.getByRole('button', { name: /check this app/i }).click();
      await expect(region.getByText(/\/v1\/projects/)).toBeVisible();

      // 7:30 secret key, shown once in the dialog, with the snippet filled in.
      await page.getByRole('button', { name: /^keys/i }).click();
      const dialog = page.getByRole('dialog', { name: /keys/i });
      await dialog.getByLabel(/label/i).fill('e2e');
      await dialog.getByRole('button', { name: /create secret key/i }).click();
      const key = (await dialog.locator('code', { hasText: /^sk_live_/ }).first().textContent())?.trim();
      expect(key, 'secret key rendered').toMatch(/^sk_live_[A-Za-z0-9_-]{20,}$/);
      // The dialog refuses to close until the key is confirmed saved.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('checkbox', { name: /i have saved this secret key/i }).check();
      await dialog.getByRole('button', { name: /^done$/i }).click();
      await expect(dialog).toHaveCount(0);

      // 8:30 the curl-equivalent: the public API answers with the project inside { data }.
      const response = await page.request.get(`${baseUrl}/projects`, { headers: { Authorization: `Bearer ${key}` } });
      expect(response.status(), await response.text()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.some((project: { title?: string }) => project.title === title)).toBe(true);
      expect(response.headers()['etag']).toBeTruthy();

      // 9:00 the dashboard notices (polling every 10 s; the server records activity at most once a minute).
      await expect(region.getByText(/your key reached us/i)).toBeVisible({ timeout: 90_000 });
    });
  });
}
