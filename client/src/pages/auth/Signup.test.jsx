import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../api/client', () => ({ api, SESSION_EXPIRED_EVENT: 'pc:session-expired' }));

import Signup from './Signup';

function renderSignup() {
  return render(<MemoryRouter><Signup /></MemoryRouter>);
}

async function fillAndSubmit(user) {
  await user.type(await screen.findByLabelText(/email address/i), 'new@example.com');
  await user.click(screen.getByLabelText(/I accept the/i));
  await user.click(screen.getByLabelText(/I have read the/i));
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

beforeEach(() => { api.post.mockResolvedValue({ data: { success: true } }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.turnstile; document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((node) => node.remove()); });

describe('Signup and Turnstile', () => {
  it('loads no Turnstile script and sends no captchaToken when the service has it off', async () => {
    api.get.mockResolvedValue({ data: { signupEnabled: true, signupMode: 'open', turnstileSiteKey: null } });
    const user = userEvent.setup();
    renderSignup();
    await fillAndSubmit(user);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1].captchaToken).toBeUndefined();
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });

  it('renders the widget when a site key is set and sends its response as captchaToken', async () => {
    api.get.mockResolvedValue({ data: { signupEnabled: true, signupMode: 'open', turnstileSiteKey: '0x4AAA-site' } });
    const render = vi.fn((element, options) => { options.callback('solved-token'); return 'widget-1'; });
    window.turnstile = { render, reset: vi.fn(), remove: vi.fn() };
    const user = userEvent.setup();
    renderSignup();
    await waitFor(() => expect(render).toHaveBeenCalled());
    expect(render.mock.calls[0][1]).toMatchObject({ sitekey: '0x4AAA-site', action: 'signup' });
    await fillAndSubmit(user);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1]).toMatchObject({ email: 'new@example.com', captchaToken: 'solved-token' });
  });

  it('explains captcha_failed from the server', async () => {
    api.get.mockResolvedValue({ data: { signupEnabled: true, signupMode: 'open', turnstileSiteKey: '0x4AAA-site' } });
    window.turnstile = { render: (element, options) => { options.callback('t'); return 'w'; }, reset: vi.fn(), remove: vi.fn() };
    api.post.mockRejectedValue({ response: { status: 400, data: { error: 'captcha_failed' } } });
    const user = userEvent.setup();
    renderSignup();
    await fillAndSubmit(user);
    expect(await screen.findByText(/verification check did not pass/i)).toBeTruthy();
    expect(window.turnstile.reset).toHaveBeenCalled();
  });
});
