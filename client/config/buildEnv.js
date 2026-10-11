// Build inputs for the dashboard: VITE_MODE, the API URL and the site identity (VITE_SITE_*).
//
// One pure module (no Vite, no fs) shared by vite.config.js, scripts/check-dist.mjs,
// scripts/check-launch.mjs and the tests, so every gate reads the env exactly as the build did.
// Everything a deploy needs is an env input here; nothing deploy-specific is a code edit.

export const MODES = { dev: 'dev', development: 'dev', prod: 'prod', production: 'prod' };
export const DEFAULT_DEV_API_URL = 'http://localhost:5000/api';
export const DEFAULT_SITE_NAME = 'Portfolio Control';

/** The site identity inputs, by field. All optional in dev; see REQUIRED_IN_PROD. */
export const SITE_VARS = {
  domain: 'VITE_SITE_DOMAIN',
  name: 'VITE_SITE_NAME',
  operator: 'VITE_SITE_OPERATOR',
  jurisdiction: 'VITE_SITE_JURISDICTION',
  supportEmail: 'VITE_SITE_SUPPORT_EMAIL',
  hostingProvider: 'VITE_SITE_HOSTING_PROVIDER',
  backupProvider: 'VITE_SITE_BACKUP_PROVIDER',
  logProvider: 'VITE_SITE_LOG_PROVIDER',
  statusUrl: 'VITE_SITE_STATUS_URL',
};
export const REQUIRED_IN_PROD = ['domain', 'operator', 'jurisdiction'];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);
const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * VITE_MODE → 'dev' | 'prod'. An unknown value throws (a typo such as `prd` must not build silently).
 * Unset keeps the old default: `vite build` means prod, the dev server means dev.
 */
export function resolveMode(raw, command) {
  const value = text(raw).toLowerCase();
  if (!value) return { mode: command === 'build' ? 'prod' : 'dev', explicit: false };
  const mode = MODES[value];
  if (!mode) throw new Error(`VITE_MODE="${raw}" is not a mode. Use dev or prod.`);
  return { mode, explicit: true };
}

/**
 * The dashboard API URL, normalised to `<origin>/api`.
 * Accepts the bare API origin (`https://api.example.com`) or that origin plus `/api`; anything else
 * (a relative path, another path, a query) throws. Prod needs https and a non-local host.
 */
export function normaliseApiUrl(raw, mode, name = mode === 'prod' ? 'VITE_PROD_API_URL' : 'VITE_DEV_API_URL') {
  const value = text(raw);
  if (!value) throw new Error(`${name} is not set. Set it to the API origin, e.g. https://api.example.com.`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name}="${value}" is not an absolute URL. Use the API origin, e.g. https://api.example.com.`); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`${name}="${value}" must be an http(s) URL.`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${name}="${value}" must not carry credentials, a query or a fragment.`);
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== '/api') throw new Error(`${name}="${value}" must be the API origin (https://api.example.com) or that origin plus /api, not the path "${url.pathname}".`);
  if (mode === 'prod') {
    if (url.protocol !== 'https:') throw new Error(`${name}="${value}" must use https in a prod build (http://localhost is for VITE_MODE=dev only).`);
    if (LOCAL_HOSTS.has(url.hostname)) throw new Error(`${name}="${value}" points at this machine; a prod build must call the deployed API.`);
  }
  return `${url.origin}/api`;
}

/** The VITE_SITE_* inputs, trimmed. Unset values are '' (site.js shows bracketed placeholders for them). */
export function resolveSite(env = {}) {
  const site = Object.fromEntries(Object.entries(SITE_VARS).map(([key, name]) => [key, text(env[name])]));
  site.domain = site.domain.toLowerCase().replace(/\.$/, '');
  site.name = site.name || DEFAULT_SITE_NAME;
  if (!site.supportEmail && site.domain) site.supportEmail = `support@${site.domain}`;
  return site;
}

/** Problems that must stop a build. `required` is true for a prod build: identity must be set. */
export function siteProblems(site, { required = false } = {}) {
  const problems = [];
  if (required) {
    for (const key of REQUIRED_IN_PROD) if (!site[key]) problems.push(`${SITE_VARS[key]} is not set; a prod build needs it.`);
  }
  if (site.domain && (/[/:]/.test(site.domain) || !DOMAIN_PATTERN.test(site.domain))) {
    problems.push(`VITE_SITE_DOMAIN="${site.domain}" must be a bare host such as portfoliocontrol.dev (no scheme, port or path).`);
  }
  if (site.supportEmail && !EMAIL_PATTERN.test(site.supportEmail)) problems.push(`VITE_SITE_SUPPORT_EMAIL="${site.supportEmail}" is not an email address.`);
  if (site.statusUrl && !/^https:\/\/[^/\s]+/.test(site.statusUrl)) problems.push(`VITE_SITE_STATUS_URL="${site.statusUrl}" must be an https URL.`);
  return problems;
}

/** True for a value that still needs the owner: unset, a bracketed placeholder, or an example domain. */
export function isPlaceholder(value) {
  const v = text(value);
  return !v || /^example\b/i.test(v) || /\[[^\]]*\]/.test(v) || /(^|[.@/])example\.(com|org|net)\b/i.test(v);
}

/**
 * Everything the build compiles in, from the env. Throws on any invalid input, and in a prod build on
 * missing identity, so a prod bundle is either correct or not produced.
 * @param {Record<string,string>} env from Vite's loadEnv
 * @param {'build'|'serve'} command
 */
export function resolveBuildEnv(env = {}, command = 'build') {
  const { mode, explicit } = resolveMode(env.VITE_MODE, command);
  const apiVar = mode === 'prod' ? 'VITE_PROD_API_URL' : 'VITE_DEV_API_URL';
  const apiUrl = normaliseApiUrl(env[apiVar] || (mode === 'dev' ? DEFAULT_DEV_API_URL : ''), mode, apiVar);
  const site = resolveSite(env);
  const problems = siteProblems(site, { required: mode === 'prod' && command === 'build' });
  if (problems.length) throw new Error(`Invalid site identity:\n  ${problems.join('\n  ')}`);
  return { mode, explicit, apiUrl, apiOrigin: new URL(apiUrl).origin, site };
}

/** The public site URL (canonical, social cards). Falls back to the dev placeholder. */
export const siteUrl = (site) => `https://${site.domain || '[your-domain]'}`;
