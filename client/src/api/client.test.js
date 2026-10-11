import { describe, it, expect, afterEach } from 'vitest';
import { AxiosError } from 'axios';
import { api, endsSession, SESSION_EXPIRED_EVENT } from './client';

// FE-01: only a 401 that means "the session is gone" signs the user out. A wrong re-auth password
// (401 credentials_invalid) must leave the session alone.

function rejectWith(status, data) {
  return (config) => Promise.reject(new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, { status, data, headers: {}, config, statusText: '' }));
}

async function expiredEventsFor(status, data) {
  let fired = 0;
  const listener = () => { fired += 1; };
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  try {
    await api.post('/admin/reauth', {}, { adapter: rejectWith(status, data) }).catch(() => {});
  } finally {
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  }
  return fired;
}

describe('session-expired event', () => {
  afterEach(() => window.history.pushState({}, '', '/'));

  it('fires for a session 401 on a dashboard page', async () => {
    window.history.pushState({}, '', '/dashboard/superadmin');
    expect(await expiredEventsFor(401, { error: 'session_expired' })).toBe(1);
    expect(await expiredEventsFor(401, {})).toBe(1);
  });

  it('does not fire for a 401 with another code (wrong re-auth password)', async () => {
    window.history.pushState({}, '', '/dashboard/superadmin');
    expect(await expiredEventsFor(401, { error: 'credentials_invalid' })).toBe(0);
  });

  it('classifies codes', () => {
    const err = (status, error) => ({ response: { status, data: error ? { error } : {} } });
    for (const code of ['auth_required', 'invalid_session', 'session_expired', 'account_inactive', 'invalid_token_type']) expect(endsSession(err(401, code))).toBe(true);
    expect(endsSession(err(401))).toBe(true);
    expect(endsSession(err(401, 'reauth_required'))).toBe(false);
    expect(endsSession(err(403, 'auth_required'))).toBe(false);
  });
});
