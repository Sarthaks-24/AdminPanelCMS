const mailer = require('../lib/mailer');
const Setting = require('../models/Setting');
const { reserveMail, refundMail, mailBudgetStatus, recipientAllowed, resetRecipientCooldowns } = require('../lib/mailBudget');

describe('transactional mail adapter', () => {
  let messages;
  beforeEach(() => {
    messages = [];
    mailer.setMailTransport({ send: async (message) => { messages.push(message); } });
  });
  afterEach(() => { mailer.setMailTransport(null); delete process.env.RESEND_MAIL_KEY; delete process.env.RESEND_FROM_EMAIL; });

  it('sends an expiry reminder with token metadata but never token secrets', async () => {
    const user = { email: 'owner@test.com' };
    const token = { label: 'Portfolio site', prefix: 'pk_live_123', expiresAt: new Date('2027-01-02T00:00:00.000Z'), value: 'raw-secret' };
    await mailer.sendTokenExpiryWarning(user, [token]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ to: user.email, template: 'token-expiry', subject: 'Portfolio Control: API key expiring soon' });
    expect(messages[0].tokens).toEqual([{ label: token.label, prefix: token.prefix, expiresAt: token.expiresAt }]);
    expect(JSON.stringify(messages[0])).not.toContain(token.value);
  });

  it('has no fallback sender: a real key without RESEND_FROM_EMAIL is not configured and refuses to send', async () => {
    mailer.setMailTransport(null);
    process.env.RESEND_MAIL_KEY = 're_live_real_key';
    delete process.env.RESEND_FROM_EMAIL;
    expect(mailer.isConfigured()).toBe(false);
    await expect(mailer.sendPasswordReset({ email: 'x@test.com' }, 'token')).rejects.toThrow(/RESEND_FROM_EMAIL/);
    process.env.RESEND_FROM_EMAIL = 'CMS <no-reply@example.com>';
    expect(mailer.isConfigured()).toBe(true);
  });

  it('links to the top-level account pages, not the old /admin paths', async () => {
    const previous = process.env.CLIENT_ORIGIN;
    process.env.CLIENT_ORIGIN = 'https://app.example.com';
    try {
      await mailer.sendVerification({ email: 'a@test.com' }, 'verify-token');
      await mailer.sendPasswordReset({ email: 'a@test.com' }, 'reset-token');
      await mailer.sendAccountExistsNotice({ email: 'a@test.com' }, 'exists-token');
    } finally {
      if (previous === undefined) delete process.env.CLIENT_ORIGIN; else process.env.CLIENT_ORIGIN = previous;
    }
    const urls = messages.map((message) => new URL(message.url));
    expect(urls.map((url) => url.pathname)).toEqual(['/verify-email', '/reset-password', '/reset-password']);
    expect(urls.map((url) => url.searchParams.get('token'))).toEqual(['verify-token', 'reset-token', 'exists-token']);
    expect(urls.every((url) => url.origin === 'https://app.example.com')).toBe(true);
  });

  describe('branding', () => {
    afterEach(() => { delete process.env.PRODUCT_NAME; delete process.env.OPERATOR_NAME; delete process.env.SUPPORT_EMAIL; });

    it('names the product in every subject', async () => {
      process.env.CLIENT_ORIGIN ||= 'https://app.example.com';
      process.env.PRODUCT_NAME = 'Acme Content';
      await mailer.sendVerification({ email: 'a@test.com' }, 't');
      await mailer.sendPasswordReset({ email: 'a@test.com' }, 't');
      await mailer.sendAccountExistsNotice({ email: 'a@test.com' }, 't');
      await mailer.sendTokenExpiryWarning({ email: 'a@test.com' }, [{ label: 'x', prefix: 'sk_live_1', expiresAt: new Date() }]);
      expect(messages.map((message) => message.subject)).toEqual([
        'Finish creating your Acme Content account',
        'Reset your Acme Content password',
        'Acme Content: someone tried to sign up with your email',
        'Acme Content: API key expiring soon',
      ]);
    });

    it('puts the product, operator, support address and the reason in the header and footer', () => {
      process.env.PRODUCT_NAME = 'Acme Content';
      process.env.OPERATOR_NAME = 'Jane Doe';
      process.env.SUPPORT_EMAIL = 'help@acme.test';
      const { html, text } = mailer.renderMail({ template: 'verification', url: 'https://app.example.com/verify-email?token=abc' });
      for (const body of [html, text]) {
        expect(body).toContain('Acme Content');
        expect(body).toContain('run by Jane Doe');
        expect(body).toContain('help@acme.test');
        expect(body).toContain('You got this email because someone (hopefully you) started creating an account on Acme Content');
        expect(body).toContain('https://app.example.com/verify-email?token=abc');
      }
      expect(html).toContain('mailto:help@acme.test');
    });

    it('falls back to placeholder defaults and omits the support line when no address is set', () => {
      const { html, text } = mailer.renderMail({ template: 'password-reset', url: 'https://app.example.com/reset-password?token=abc' });
      expect(text).toContain('Portfolio Control is run by Portfolio Control.');
      expect(text).not.toContain('Questions?');
      expect(html).not.toContain('mailto:');
    });

    it('escapes configured names in the HTML', () => {
      process.env.PRODUCT_NAME = '<b>Acme</b>';
      process.env.OPERATOR_NAME = 'A & B';
      const { html } = mailer.renderMail({ template: 'account-exists', url: 'https://x.test/reset-password?token=1&a=<2>' });
      expect(html).not.toContain('<b>Acme</b>');
      expect(html).toContain('&lt;b&gt;Acme&lt;/b&gt;');
      expect(html).toContain('A &amp; B');
      expect(html).toContain('a=&lt;2&gt;');
    });
  });
});

describe('daily mail budget', () => {
  afterEach(() => { delete process.env.MAIL_DAILY_CAP; delete process.env.MAIL_RESET_RESERVE; resetRecipientCooldowns(); });

  it('counts atomically in a Setting document and keeps the reserve for reset mail', async () => {
    process.env.MAIL_DAILY_CAP = '5';
    process.env.MAIL_RESET_RESERVE = '2';
    // Four concurrent reserves against a non-reserved budget of 3: exactly three win, in any order.
    const outcomes = await Promise.all([reserveMail(), reserveMail(), reserveMail(), reserveMail()]);
    expect(outcomes.filter(Boolean)).toHaveLength(3);
    expect(await reserveMail()).toBe(false);
    expect(await reserveMail({ reset: true })).toBe(true);
    expect(await reserveMail({ reset: true })).toBe(true);
    expect(await reserveMail({ reset: true })).toBe(false);
    const status = await mailBudgetStatus();
    expect(status).toMatchObject({ sent: 5, cap: 5, reserve: 2 });
    expect(status.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await Setting.findOne({ key: `mail:${status.day}` }).lean()).toMatchObject({ value: 5 });
    await refundMail();
    expect((await mailBudgetStatus()).sent).toBe(4);
    expect(await reserveMail({ reset: true })).toBe(true);
  });

  it('applies a per-recipient cooldown of one send per five minutes and three per day', () => {
    const start = Date.now();
    expect(recipientAllowed('reset', 'A@test.com', { now: start })).toBe(true);
    expect(recipientAllowed('reset', 'a@test.com', { now: start + 60_000 })).toBe(false);
    expect(recipientAllowed('reset', 'a@test.com', { now: start + 6 * 60_000 })).toBe(true);
    expect(recipientAllowed('reset', 'a@test.com', { now: start + 12 * 60_000 })).toBe(true);
    expect(recipientAllowed('reset', 'a@test.com', { now: start + 18 * 60_000 })).toBe(false);
    expect(recipientAllowed('verify', 'a@test.com', { now: start + 18 * 60_000 })).toBe(true);
    expect(recipientAllowed('reset', 'a@test.com', { now: start + 25 * 60 * 60_000 })).toBe(true);
  });
});
