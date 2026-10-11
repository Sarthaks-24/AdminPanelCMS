import { describe, it, expect } from 'vitest';
import { hostOf, provablyCrossSite } from './sameSite';

// FE-09: only provably cross-site pairs are reported (no Public Suffix List).
describe('provablyCrossSite', () => {
  it('passes the documented topology: dashboard on the apex, API on api.<apex>', () => {
    expect(provablyCrossSite('portfoliocontrol.dev', 'api.portfoliocontrol.dev')).toBe(false);
    expect(provablyCrossSite('cms.example.com', 'api.example.com')).toBe(false);
    expect(provablyCrossSite('example.com', 'example.com')).toBe(false);
  });

  it('fails when the last two labels differ', () => {
    expect(provablyCrossSite('example.com', 'api.example.org')).toBe(true);
    expect(provablyCrossSite('my-dash.pages.dev', 'my-api.onrender.com')).toBe(true);
  });

  it('fails for two subdomains of one shared-hosting suffix', () => {
    expect(provablyCrossSite('dash.pages.dev', 'api.pages.dev')).toBe(true);
    expect(provablyCrossSite('a.up.railway.app', 'b.up.railway.app')).toBe(true);
    expect(provablyCrossSite('a.github.io', 'b.github.io')).toBe(true);
  });

  it('does not guess when it cannot decide', () => {
    expect(provablyCrossSite('a.co.uk', 'b.co.uk')).toBe(false);
    expect(provablyCrossSite('', 'api.example.com')).toBe(false);
  });

  it('ignores case, ports and a trailing dot', () => {
    expect(provablyCrossSite('Example.COM.', 'api.example.com:443')).toBe(false);
  });
});

describe('hostOf', () => {
  it('returns the host of an absolute URL, or empty', () => {
    expect(hostOf('https://api.example.com/api')).toBe('api.example.com');
    expect(hostOf('/api')).toBe('');
  });
});
