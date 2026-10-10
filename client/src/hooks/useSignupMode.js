import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * The server decides whether anyone may register: closed, invite-only or open.
 * The public pages ask once and hide the registration link rather than offer a dead end.
 * An unreachable API is treated as closed, which is the safe direction to be wrong in.
 */
export function useSignupMode() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/auth/config', { skipAuthRedirect: true })
      .then(({ data }) => { if (active) setMode(data.signupMode || (data.signupEnabled ? 'open' : 'closed')); })
      .catch(() => { if (active) setMode('closed'); });
    return () => { active = false; };
  }, []);

  // The server answers with exactly one of 'open', 'invite' or 'closed' (see server/lib/signupMode.js).
  return {
    mode,
    isOpen: mode === 'open',
    isInviteOnly: mode === 'invite',
    isClosed: mode === 'closed',
    // Null while the answer is in flight, so nothing flashes in and out of the nav.
    resolved: mode !== null,
  };
}
