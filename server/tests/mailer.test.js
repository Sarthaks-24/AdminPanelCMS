const mailer = require('../lib/mailer');

describe('transactional mail adapter', () => {
  let messages;
  beforeEach(() => {
    messages = [];
    mailer.setMailTransport({ send: async (message) => { messages.push(message); } });
  });
  afterEach(() => mailer.setMailTransport(null));

  it('sends an expiry reminder with token metadata but never token secrets', async () => {
    const user = { email: 'owner@test.com' };
    const token = { label: 'Portfolio site', prefix: 'pk_live_123', expiresAt: new Date('2027-01-02T00:00:00.000Z'), value: 'raw-secret' };
    await mailer.sendTokenExpiryWarning(user, [token]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ to: user.email, template: 'token-expiry', subject: 'API token expiring soon' });
    expect(messages[0].tokens).toEqual([{ label: token.label, prefix: token.prefix, expiresAt: token.expiresAt }]);
    expect(JSON.stringify(messages[0])).not.toContain(token.value);
  });
});
