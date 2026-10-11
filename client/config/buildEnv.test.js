import { describe, it, expect } from 'vitest';
import { isPlaceholder, normaliseApiUrl, resolveBuildEnv, resolveMode, resolveSite } from './buildEnv.js';
import { cspHeader, cspMeta, parseCsp } from './csp.js';
import { fillSiteTokens, injectCspMeta, securityTxt } from './deployFiles.js';

const PROD_SITE = { VITE_SITE_DOMAIN: 'portfoliocontrol.dev', VITE_SITE_OPERATOR: 'Jane Doe', VITE_SITE_JURISDICTION: 'India' };

describe('VITE_MODE (CB-02)', () => {
  it('maps the known values and throws on anything else', () => {
    expect(resolveMode('prod', 'serve')).toEqual({ mode: 'prod', explicit: true });
    expect(resolveMode(' Development ', 'build').mode).toBe('dev');
    expect(() => resolveMode('prd', 'build')).toThrow(/VITE_MODE="prd"/);
  });
  it('keeps the default when unset: build → prod, dev server → dev', () => {
    expect(resolveMode('', 'build')).toEqual({ mode: 'prod', explicit: false });
    expect(resolveMode(undefined, 'serve')).toEqual({ mode: 'dev', explicit: false });
  });
});

describe('API URL (CB-03)', () => {
  it('accepts a bare origin or origin + /api and normalises to <origin>/api', () => {
    expect(normaliseApiUrl('https://api.example.com', 'prod')).toBe('https://api.example.com/api');
    expect(normaliseApiUrl('https://api.example.com/', 'prod')).toBe('https://api.example.com/api');
    expect(normaliseApiUrl('https://api.example.com/api/', 'prod')).toBe('https://api.example.com/api');
    expect(normaliseApiUrl('http://localhost:5000', 'dev')).toBe('http://localhost:5000/api');
  });
  it('rejects relative URLs, other paths, http and localhost in prod', () => {
    expect(() => normaliseApiUrl('/api', 'prod')).toThrow(/absolute URL/);
    expect(() => normaliseApiUrl('https://api.example.com/v1', 'prod')).toThrow(/not the path/);
    expect(() => normaliseApiUrl('http://api.example.com', 'prod')).toThrow(/https/);
    expect(() => normaliseApiUrl('https://localhost:5000', 'prod')).toThrow(/this machine/);
    expect(() => normaliseApiUrl('', 'prod')).toThrow(/VITE_PROD_API_URL is not set/);
  });
  it('does not fall back to /api or the legacy VITE_API_URL in prod', () => {
    expect(() => resolveBuildEnv({ VITE_MODE: 'prod', VITE_API_URL: 'https://api.example.com', ...PROD_SITE }, 'build')).toThrow(/VITE_PROD_API_URL is not set/);
  });
  it('defaults the dev API to localhost', () => {
    expect(resolveBuildEnv({}, 'serve').apiUrl).toBe('http://localhost:5000/api');
  });
});

describe('site identity (CB-17)', () => {
  it('a prod build needs domain, operator and jurisdiction', () => {
    expect(() => resolveBuildEnv({ VITE_MODE: 'prod', VITE_PROD_API_URL: 'https://api.portfoliocontrol.dev' }, 'build'))
      .toThrow(/VITE_SITE_DOMAIN is not set[\s\S]*VITE_SITE_OPERATOR[\s\S]*VITE_SITE_JURISDICTION/);
    const build = resolveBuildEnv({ VITE_MODE: 'prod', VITE_PROD_API_URL: 'https://api.portfoliocontrol.dev', ...PROD_SITE }, 'build');
    expect(build.apiOrigin).toBe('https://api.portfoliocontrol.dev');
    expect(build.site).toMatchObject({ domain: 'portfoliocontrol.dev', name: 'Portfolio Control', supportEmail: 'support@portfoliocontrol.dev' });
  });
  it('rejects a domain with a scheme', () => {
    expect(() => resolveBuildEnv({ VITE_SITE_DOMAIN: 'https://portfoliocontrol.dev' }, 'serve')).toThrow(/bare host/);
  });
  it('dev needs nothing', () => {
    expect(resolveSite({}).domain).toBe('');
  });
  it('flags placeholders and example values', () => {
    expect(isPlaceholder('[Jurisdiction]')).toBe(true);
    expect(isPlaceholder('example.com')).toBe(true);
    expect(isPlaceholder('support@example.com')).toBe(true);
    expect(isPlaceholder('api.example.com')).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('portfoliocontrol.dev')).toBe(false);
  });
});

describe('deploy files (CB-07a, FE-05)', () => {
  const options = { apiOrigin: 'https://api.portfoliocontrol.dev', scriptHashes: ['sha256-abc='] };

  it('puts the API origin and script hashes in both policies; the meta drops frame-ancestors', () => {
    const header = parseCsp(cspHeader(options));
    expect(header.get('connect-src')).toEqual(["'self'", 'https://api.portfoliocontrol.dev']);
    expect(header.get('script-src')).toContain("'sha256-abc='");
    expect(header.get('frame-ancestors')).toEqual(["'none'"]);
    const meta = parseCsp(cspMeta(options));
    expect(meta.has('frame-ancestors')).toBe(false);
    expect(meta.get('connect-src')).toContain('https://api.portfoliocontrol.dev');
  });

  it('injects the meta before the first script', () => {
    const html = injectCspMeta('<head><meta charset="UTF-8" /><script>x()</script></head>', "default-src 'self'");
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script>'));
  });

  it('fills the site tokens and a security.txt that expires in a year', () => {
    const site = { domain: 'portfoliocontrol.dev', name: 'A & B' };
    expect(fillSiteTokens('<link href="%SITE_URL%/"><title>%SITE_NAME%</title>', site)).toBe('<link href="https://portfoliocontrol.dev/"><title>A &amp; B</title>');
    const txt = securityTxt('Contact: mailto:security@%SITE_DOMAIN%\nExpires: %EXPIRES%', { site, now: new Date('2026-10-12T00:00:00Z') });
    expect(txt).toBe('Contact: mailto:security@portfoliocontrol.dev\nExpires: 2027-10-12T00:00:00.000Z');
  });
});
