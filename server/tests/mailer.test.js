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
    expect(messages[0]).toMatchObject({ to: user.email, template: 'token-expiry', subject: 'API token expiring soon' });
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
