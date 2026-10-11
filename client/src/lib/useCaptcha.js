import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPublicConfig } from './apiBase';

/**
 * Turnstile state for one form. `siteKey` comes from GET /api/auth/config (null when the service has
 * the check off, in which case `required` is false and nothing renders). Spread `widgetProps` onto
 * <Turnstile>, send `token` as `captchaToken`, and call `reset()` after every submit (tokens are single-use).
 */
export default function useCaptcha() {
  const [siteKey, setSiteKey] = useState(null);
  const [token, setToken] = useState('');
  const widgetRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadPublicConfig().then((config) => { if (active) setSiteKey(config?.turnstileSiteKey || null); });
    return () => { active = false; };
  }, []);

  const reset = useCallback(() => { setToken(''); widgetRef.current?.reset(); }, []);

  return {
    siteKey,
    required: Boolean(siteKey),
    token,
    ready: !siteKey || Boolean(token),
    reset,
    widgetProps: { ref: widgetRef, siteKey, onToken: setToken },
  };
}

/** Message for the captcha error codes the mail-sending endpoints return. */
export const CAPTCHA_ERRORS = {
  captcha_required: 'Complete the verification check, then try again.',
  captcha_failed: 'The verification check did not pass. Try it again.',
  captcha_unavailable: 'Verification is temporarily unavailable. Please try again in a minute.',
};
