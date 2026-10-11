import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Where a tenant's own apps call the public API.
 *
 * The one rule, used by every doc, snippet and screen:
 *   - `apiOrigin` is the bare origin of the public API (`https://api.example.com`): no path, no
 *     trailing slash. It is what the docs' `{{API_BASE}}` placeholder renders as, and every documented
 *     path starts with `/v1` (`{{API_BASE}}/v1/projects`).
 *   - `v1Base` is `apiOrigin + '/v1'`, for screens that append a section name (`${v1Base}/projects`).
 * Never join a documented `/v1/...` path to `v1Base`; that is how `/v1/v1` happens.
 * scripts/check-docs.mjs asserts the docs follow this.
 *
 * Source of truth is the server: `GET /api/auth/config` returns `publicApiBase` (PUBLIC_API_URL, a
 * bare https origin). When the server has none configured, fall back to the origin of the dashboard
 * API URL compiled into this bundle (vite.config.js always compiles an absolute `<origin>/api`).
 * That fallback is a guess, so callers render `…` until `resolved` and can tell a configured base
 * from a guessed one with `configured`.
 */
export function fallbackApiOrigin() {
  const compiled = import.meta.env.VITE_RESOLVED_API_URL || '';
  let absolute;
  try {
    absolute = new URL(compiled, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch {
    return '';
  }
  const path = absolute.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${absolute.origin}${path}`;
}

/** Normalises a configured base to a bare origin: trims, drops trailing slashes and a trailing `/v1`. */
export function resolveApiOrigin(publicApiBase) {
  const base = typeof publicApiBase === 'string' ? publicApiBase.trim().replace(/\/+$/, '').replace(/\/v1$/, '') : '';
  return base || fallbackApiOrigin();
}

export const v1BaseFor = (origin) => `${origin}/v1`;

let configPromise = null;
// One fetch per page load; every caller shares it.
export function loadPublicConfig() {
  if (!configPromise) {
    configPromise = api.get('/auth/config', { skipAuthRedirect: true })
      .then(({ data }) => data)
      .catch(() => { configPromise = null; return null; });
  }
  return configPromise;
}

/**
 * @returns {{ apiOrigin: string, v1Base: string, resolved: boolean, configured: boolean, config: object|null }}
 * `resolved` is false until the server has answered (or failed to). `configured` is true only when the
 * server reported a non-empty `publicApiBase`; otherwise `apiOrigin`/`v1Base` are the bundle's guess.
 */
export function useApiBase() {
  const [state, setState] = useState(() => {
    const apiOrigin = fallbackApiOrigin();
    return { apiOrigin, v1Base: v1BaseFor(apiOrigin), resolved: false, configured: false, config: null };
  });
  useEffect(() => {
    let active = true;
    loadPublicConfig().then((config) => {
      if (!active) return;
      const configured = typeof config?.publicApiBase === 'string' && config.publicApiBase.trim() !== '';
      const apiOrigin = resolveApiOrigin(config?.publicApiBase);
      setState({ apiOrigin, v1Base: v1BaseFor(apiOrigin), resolved: true, configured, config });
    });
    return () => { active = false; };
  }, []);
  return state;
}

/** What to print for a base URL that may not be known yet. */
export const PENDING_BASE = '…';
