import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import Turnstile from '../Turnstile';
import useCaptcha, { CAPTCHA_ERRORS } from '../../lib/useCaptcha';

/**
 * "Resend verification" for a signed-in but unverified account. When the service has Turnstile on,
 * the first click shows the challenge and the request goes out as soon as it is solved.
 */
export default function ResendVerification({ email, className = '' }) {
  const captcha = useCaptcha();
  const [state, setState] = useState({ phase: 'idle', text: '' }); // idle | challenge | sending | done | error
  const wantsSend = useRef(false);

  async function send(token) {
    wantsSend.current = false;
    setState({ phase: 'sending', text: '' });
    try {
      await api.post('/auth/resend-verification', { email, captchaToken: captcha.required ? token : undefined });
      setState({ phase: 'done', text: 'If verification is needed, a message will be sent.' });
    } catch (err) {
      const code = err.response?.data?.error;
      setState({ phase: 'error', text: CAPTCHA_ERRORS[code] || (code === 'rate_limited' ? 'Too many requests. Wait a while before asking again.' : code === 'mail_budget' ? 'We cannot send more email today. Please try again tomorrow.' : 'Could not request a verification email. Please try again later.') });
    } finally { captcha.reset(); }
  }

  // The challenge was solved after the click: send now.
  useEffect(() => {
    if (wantsSend.current && captcha.token) send(captcha.token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captcha.token]);

  function onClick() {
    if (captcha.required && !captcha.token) { wantsSend.current = true; setState({ phase: 'challenge', text: '' }); return; }
    send(captcha.token);
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button type="button" onClick={onClick} disabled={state.phase === 'sending'} className={`rounded font-semibold text-t-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent disabled:opacity-60 ${className}`}>
        {state.phase === 'sending' ? 'Sending…' : 'Resend verification email'}
      </button>
      {state.phase === 'challenge' && <Turnstile {...captcha.widgetProps} action="resend-verification" />}
      {state.text && <span role={state.phase === 'error' ? 'alert' : 'status'} className={`text-sm ${state.phase === 'error' ? 'text-t-danger' : 'text-t-muted'}`}>{state.text}</span>}
    </span>
  );
}
