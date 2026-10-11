import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * The public /v1 base URL that a tenant's own apps call.
 *
 * Source of truth is the server: `GET /api/auth/config` returns `publicApiBase`
 * (from the PUBLIC_API_URL env var, e.g. "https://api.example.com"). When the
 * server has none configured, fall back to the dashboard API URL compiled into
 * this bundle with its trailing `/api` removed, resolved against the page origin.
 *
 * Both return values end in `/v1` and never carry a trailing slash.
 */
export function fallbackApiBase() {
  const compiled = import.meta.env.VITE_RESOLVED_API_URL || '/api';
  let absolute;
  try {
    absolute = new URL(compiled, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch {
    return '/v1';
  }
  const path = absolute.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${absolute.origin}${path}/v1`;
}

export function resolveV1Base(publicApiBase) {
  const base = typeof publicApiBase === 'string' ? publicApiBase.trim().replace(/\/+$/, '') : '';
  if (!base) return fallbackApiBase();
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

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

/** @returns {{ v1Base: string, resolved: boolean, config: object|null }} */
export function useApiBase() {
  const [state, setState] = useState({ v1Base: fallbackApiBase(), resolved: false, config: null });
  useEffect(() => {
    let active = true;
    loadPublicConfig().then((config) => {
      if (active) setState({ v1Base: resolveV1Base(config?.publicApiBase), resolved: true, config });
    });
    return () => { active = false; };
  }, []);
  return state;
}
