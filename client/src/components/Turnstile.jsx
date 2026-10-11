import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise = null;

// Loaded on demand, and only on pages that render a widget, only when the server has a site key.
function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
      script.onerror = () => { scriptPromise = null; script.remove(); reject(new Error('turnstile failed to load')); };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Cloudflare Turnstile challenge. `onToken(token)` gets the response ('' when it expires or errors).
 * The ref exposes `reset()`, for after a submit: each token is single-use.
 */
const Turnstile = forwardRef(function Turnstile({ siteKey, onToken, action, className = '' }, ref) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const onTokenRef = useRef(onToken);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current?.('');
      if (widgetId.current !== null) window.turnstile?.reset(widgetId.current);
    },
  }), []);

  useEffect(() => {
    if (!siteKey) return undefined;
    let cancelled = false;
    loadTurnstile().then((turnstile) => {
      if (cancelled || !containerRef.current) return;
      widgetId.current = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: 'auto',
        callback: (token) => onTokenRef.current?.(token),
        'expired-callback': () => onTokenRef.current?.(''),
        'error-callback': () => onTokenRef.current?.(''),
      });
    }).catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => {
      cancelled = true;
      if (widgetId.current !== null) { try { window.turnstile?.remove(widgetId.current); } catch { /* already gone */ } }
      widgetId.current = null;
    };
  }, [siteKey, action]);

  if (!siteKey) return null;
  return (
    <div className={className}>
      <div ref={containerRef} />
      {loadFailed && <p role="alert" className="mt-2 text-sm text-t-danger">The verification check could not load. Disable content blockers for this page, or reload and try again.</p>}
    </div>
  );
});

export default Turnstile;
