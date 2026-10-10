const { applyMode, resolveMode, MODE_KEYS } = require('../lib/envMode');

describe('MODE environment switch', () => {
  it('copies the active mode values onto the plain names and pins NODE_ENV', () => {
    const env = { MODE: 'prod', DEV_MONGODB_URI: 'mongodb://dev/Dev', PROD_MONGODB_URI: 'mongodb://prod/Prod', PROD_SIGNUP_MODE: 'closed', DEV_SIGNUP_MODE: 'invite' };
    expect(applyMode(env)).toBe('prod');
    expect(env).toMatchObject({ MONGODB_URI: 'mongodb://prod/Prod', SIGNUP_MODE: 'closed', NODE_ENV: 'production' });

    const dev = { MODE: 'dev', DEV_MONGODB_URI: 'mongodb://dev/Dev', PROD_MONGODB_URI: 'mongodb://prod/Prod' };
    expect(applyMode(dev)).toBe('dev');
    expect(dev).toMatchObject({ MONGODB_URI: 'mongodb://dev/Dev', NODE_ENV: 'development' });
  });

  it('never borrows the other mode and falls back to the plain name when a prefixed value is blank', () => {
    const env = { MODE: 'prod', DEV_JWT_SECRET: 'dev-secret', PROD_JWT_SECRET: '', CLIENT_ORIGIN: 'https://host-provided.example.com', PROD_CLIENT_ORIGIN: '' };
    applyMode(env);
    expect(env.JWT_SECRET).toBeUndefined();
    expect(env.CLIENT_ORIGIN).toBe('https://host-provided.example.com');

    const stale = { MODE: 'prod', MONGODB_URI: 'mongodb://dev/Dev', DEV_MONGODB_URI: 'mongodb://dev/Dev', PROD_MONGODB_URI: '' };
    applyMode(stale);
    expect(stale.MONGODB_URI).toBeUndefined();
  });

  it('accepts the long spellings and an old NODE_ENV-only file, and rejects anything ambiguous', () => {
    expect(resolveMode({ MODE: 'Production' })).toBe('prod');
    expect(resolveMode({ MODE: 'development' })).toBe('dev');
    expect(resolveMode({ NODE_ENV: 'production' })).toBe('prod');
    expect(resolveMode({ NODE_ENV: 'development' })).toBe('dev');
    expect(() => resolveMode({})).toThrow(/MODE is not set/);
    expect(() => resolveMode({ MODE: 'staging' })).toThrow(/dev.*prod/);
    expect(() => resolveMode({ MODE: 'dev', NODE_ENV: 'production' })).toThrow(/conflicts/);
  });

  it('leaves the test environment untouched', () => {
    const env = { NODE_ENV: 'test', MODE: 'prod', PROD_MONGODB_URI: 'mongodb://prod/Prod' };
    expect(applyMode(env)).toBe('test');
    expect(env.MONGODB_URI).toBeUndefined();
  });

  it('covers every setting that differs between development and production', () => {
    expect(MODE_KEYS).toEqual(expect.arrayContaining(['MONGODB_URI', 'JWT_SECRET', 'CLIENT_ORIGIN', 'TRUST_PROXY_HOPS', 'SIGNUP_MODE']));
  });

  it('keeps .env.example in step with MODE_KEYS: every key once per mode, and no plain duplicates', () => {
    const template = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '.env.example'), 'utf8');
    const names = [...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
    const strip = (prefix) => names.filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length)).sort();
    expect(names[0]).toBe('MODE');
    expect(strip('DEV_')).toEqual([...MODE_KEYS].sort());
    expect(strip('PROD_')).toEqual([...MODE_KEYS].sort());
    expect(names.filter((name) => MODE_KEYS.includes(name))).toEqual([]);
    expect(names).not.toContain('NODE_ENV');
  });
});
