import { useEffect, useState } from 'react';
import { loadPublicConfig } from '../lib/apiBase';

/**
 * The server decides whether anyone may register: closed, invite-only or open.
 * The public pages ask once (sharing the fetch with useApiBase) and only use the answer to word
 * the account button. The button itself renders in every state, including while the answer is
 * in flight and when the API cannot be reached: an unreachable API is 'unknown', not 'closed',
 * and the signup page explains the real mode once it loads.
 */
export function useSignupMode() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let active = true;
    loadPublicConfig().then((data) => {
      if (!active) return;
      if (!data) { setMode('unknown'); return; }
      setMode(data.signupMode || (data.signupEnabled ? 'open' : 'closed'));
    });
    return () => { active = false; };
  }, []);

  // The server answers with exactly one of 'open', 'invite' or 'closed' (see server/lib/signupMode.js).
  return {
    mode,
    isOpen: mode === 'open',
    isInviteOnly: mode === 'invite',
    isClosed: mode === 'closed',
    // The request failed. Treated like 'open' wherever a CTA is rendered: a dead button beats no button.
    isUnknown: mode === 'unknown',
    // Null while the answer is in flight, so nothing flashes in and out of the nav.
    resolved: mode !== null,
  };
}
