const fs = require('node:fs');
const path = require('node:path');
const { provablyCrossSite } = require('../lib/sameSite');
const { envNumber, numericEnvProblems, disabledGuards } = require('../lib/envNumber');
const { mailReadinessProblems } = require('../lib/mailReadiness');
const { inviteDigest } = require('../lib/emailTokens');
const mailer = require('../lib/mailer');

describe('same-site check (FE-09)', () => {
  it('only reports pairs that are provably cross-site', () => {
    expect(provablyCrossSite('https://example.com', 'https://api.example.com')).toBe(false);
    expect(provablyCrossSite('https://cms.example.com', 'https://api.example.com')).toBe(false);
    expect(provablyCrossSite('https://api.example.com', 'https://api.example.com')).toBe(false);
    // Undecidable without the Public Suffix List: left to the deploy smoke check, never asserted either way.
    expect(provablyCrossSite('https://a.example.co.uk', 'https://b.example.co.uk')).toBe(false);
    expect(provablyCrossSite('https://cms.example.com', 'https://api.example.org')).toBe(true);
    expect(provablyCrossSite('https://cms.pages.dev', 'https://cms-api.onrender.com')).toBe(true);
    expect(provablyCrossSite('https://dash.up.railway.app', 'https://api.up.railway.app')).toBe(true);
    expect(provablyCrossSite('https://user.github.io', 'https://api.github.io')).toBe(true);
    expect(provablyCrossSite('not a url', 'https://api.example.com')).toBe(false);
  });
});

describe('numeric env settings (CB-14)', () => {
  it('uses the default for blank or invalid values and honours an explicit 0', () => {
    expect(envNumber('STORAGE_CHECK_INTERVAL_MINUTES', {})).toBe(10);
    expect(envNumber('STORAGE_CHECK_INTERVAL_MINUTES', { STORAGE_CHECK_INTERVAL_MINUTES: '' })).toBe(10);
    expect(envNumber('STORAGE_CHECK_INTERVAL_MINUTES', { STORAGE_CHECK_INTERVAL_MINUTES: '10m' })).toBe(10);
    expect(envNumber('STORAGE_CHECK_INTERVAL_MINUTES', { STORAGE_CHECK_INTERVAL_MINUTES: '0' })).toBe(0);
    expect(envNumber('STORAGE_CHECK_INTERVAL_MINUTES', { STORAGE_CHECK_INTERVAL_MINUTES: '2.5' })).toBe(2.5);
    expect(envNumber('MAX_ACCOUNTS', { MAX_ACCOUNTS: 'fifty' })).toBe(0);
    expect(envNumber('MAX_ACCOUNTS', { MAX_ACCOUNTS: '50' })).toBe(50);
    expect(numericEnvProblems({ MAX_ACCOUNTS: 'fifty', SWEEP_DELETED_INTERVAL_HOURS: '-1', MAIL_DAILY_CAP: '' })).toEqual([
      expect.stringMatching(/^MAX_ACCOUNTS/), expect.stringMatching(/^SWEEP_DELETED_INTERVAL_HOURS/),
    ]);
    expect(disabledGuards({ SWEEP_DELETED_INTERVAL_HOURS: '0', STORAGE_CHECK_INTERVAL_MINUTES: '' })).toEqual([expect.stringMatching(/deleted-account sweep is DISABLED/)]);
  });

  it('keeps the guards running when a value is blank or invalid', () => {
    const { startStorageMonitor } = require('../lib/storageGuard');
    const { startDeletedSweep } = require('../lib/sweepDeleted');
    const previous = { ...process.env };
    try {
      process.env.STORAGE_CHECK_INTERVAL_MINUTES = '';
      process.env.SWEEP_DELETED_INTERVAL_HOURS = 'six';
      const storage = startStorageMonitor({ log: { error() {}, warn() {} } });
      const sweep = startDeletedSweep({ log: { log() {}, error() {}, warn() {} } });
      expect(storage).not.toBeNull();
      expect(sweep).not.toBeNull();
      storage.stop(); sweep.stop();
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_CHECK_INTERVAL_MINUTES = '0';
      const warn = vi.fn();
      expect(startStorageMonitor({ log: { error() {}, warn } })).toBeNull();
      expect(warn.mock.calls[0][1]).toMatch(/DISABLED/);
    } finally {
      for (const key of ['STORAGE_CHECK_INTERVAL_MINUTES', 'SWEEP_DELETED_INTERVAL_HOURS']) delete process.env[key];
      process.env.NODE_ENV = previous.NODE_ENV;
    }
  });
});

describe('mail readiness (CB-01)', () => {
  const ready = { RESEND_MAIL_KEY: 're_live_key', RESEND_FROM_EMAIL: 'CMS <no-reply@example.com>', OPERATOR_NAME: 'Example Ltd', SUPPORT_EMAIL: 'support@example.com' };
  it('lists every reason account mail cannot work', () => {
    expect(mailReadinessProblems(ready)).toEqual([]);
    expect(mailReadinessProblems({})).toEqual([
      expect.stringMatching(/RESEND_MAIL_KEY/), expect.stringMatching(/OPERATOR_NAME/), expect.stringMatching(/SUPPORT_EMAIL is empty/),
    ]);
    expect(mailReadinessProblems({ ...ready, RESEND_FROM_EMAIL: 'onboarding@resend.dev' })).toEqual([expect.stringMatching(/test sender/)]);
    expect(mailReadinessProblems({ ...ready, SUPPORT_EMAIL: 'not-an-address' })).toEqual([expect.stringMatching(/plain email/)]);
    expect(mailReadinessProblems({ ...ready, MAIL_DAILY_CAP: '20' })).toEqual([expect.stringMatching(/MAIL_DAILY_CAP leaves nothing/)]);
  });
});

describe('invite pepper (BE-03)', () => {
  afterEach(() => { process.env.NODE_ENV = 'test'; delete process.env.INVITE_CODE_PEPPER; });
  it('never falls back to JWT_SECRET in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => inviteDigest('ABCDEFGHJKLM')).toThrow(/INVITE_CODE_PEPPER is required/);
    process.env.INVITE_CODE_PEPPER = 'p'.repeat(48);
    const production = inviteDigest('ABCDEFGHJKLM');
    process.env.NODE_ENV = 'test';
    // Same pepper, same digest: a script and the server agree whenever they share the pepper.
    expect(inviteDigest('ABCDEFGHJKLM')).toBe(production);
  });
});

describe('console mail transport (NF-17)', () => {
  afterEach(() => { delete process.env.MAIL_TRANSPORT; process.env.NODE_ENV = 'test'; });
  it('prints the email with its link instead of sending it, and is ignored in production', async () => {
    process.env.MAIL_TRANSPORT = 'console';
    expect(mailer.isConfigured()).toBe(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await mailer.sendVerification({ email: 'new@example.com' }, 'tok123');
      const printed = log.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(printed).toMatch(/To: new@example\.com/);
      expect(printed).toMatch(/Subject: Finish creating your/);
      expect(printed).toContain('/verify-email?token=tok123');
    } finally { log.mockRestore(); }
    process.env.NODE_ENV = 'production';
    expect(mailer.consoleMailActive()).toBe(false);
    await expect(mailer.sendVerification({ email: 'new@example.com' }, 'tok123')).rejects.toThrow(/not configured/);
  });

  it('is the development default only while no Resend key is set', () => {
    expect(mailer.consoleMailActive({ NODE_ENV: 'development' })).toBe(true);
    expect(mailer.consoleMailActive({ NODE_ENV: 'development', RESEND_MAIL_KEY: 're_xxxxxxxxx' })).toBe(true);
    expect(mailer.consoleMailActive({ NODE_ENV: 'development', RESEND_MAIL_KEY: 're_live_key' })).toBe(false);
    expect(mailer.consoleMailActive({ NODE_ENV: 'development', RESEND_MAIL_KEY: 're_live_key', MAIL_TRANSPORT: 'console' })).toBe(true);
    expect(mailer.consoleMailActive({ NODE_ENV: 'development', MAIL_TRANSPORT: 'resend' })).toBe(false);
    expect(mailer.consoleMailActive({ NODE_ENV: 'production', MAIL_TRANSPORT: 'console' })).toBe(false);
  });
});

describe('.env.example inventory (CB-25)', () => {
  // Read by the runtime or tooling, not configured by operators in server/.env.
  const IGNORED = new Set(['NODE_ENV', 'RESUME_URL']);
  const root = path.join(__dirname, '..');

  function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (['node_modules', 'tests', 'cache', 'coverage'].includes(entry.name)) return [];
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? sourceFiles(full) : (entry.name.endsWith('.js') ? [full] : []);
    });
  }

  it('documents every environment variable the server and its scripts read', () => {
    const template = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
    const documented = new Set([...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1].replace(/^(DEV|PROD)_/, '')));
    const read = new Set(Object.keys(require('../lib/envNumber').NUMERIC_ENV));
    for (const file of sourceFiles(root)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)(?![a-z])/g)) read.add(match[1]);
      for (const match of source.matchAll(/\benv\.([A-Z][A-Z0-9_]*)(?![a-z])/g)) read.add(match[1].replace(/^(DEV|PROD)_/, ''));
    }
    const missing = [...read].filter((name) => !IGNORED.has(name) && !documented.has(name)).sort();
    expect(missing).toEqual([]);
  });
});
