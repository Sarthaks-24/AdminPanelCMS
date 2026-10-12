import fs from 'node:fs';
import path from 'node:path';
import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { buildCustomRecord, ThemeProvider, useTheme } from './ThemeContext';
import { SCHEMA_VERSION } from '../theme/derive';

// The inline script in index.html, run the way the browser runs it: before React, against whatever is stored.
const html = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'index.html'), 'utf8');
const prePaint = html.match(/<script>(try \{[^<]*)<\/script>/)[1];
const runPrePaint = () => new Function(prePaint)();

const root = () => document.documentElement;
function resetDocument() {
  root().removeAttribute('data-theme');
  root().removeAttribute('style');
  localStorage.clear();
}

describe('pre-paint script', () => {
  beforeEach(resetDocument);

  it('applies a preset id', () => {
    localStorage.setItem('pc_theme', 'nordic-frost');
    runPrePaint();
    expect(root().getAttribute('data-theme')).toBe('nordic-frost');
  });

  it('applies a valid custom theme as inline colours', () => {
    const record = buildCustomRecord({ bg: '#f4f1ea', accent: '#1d4ed8', accent2: '#be185d', contrast: 'standard' });
    localStorage.setItem('pc_theme', 'custom');
    localStorage.setItem('pc_theme_custom', JSON.stringify(record));
    runPrePaint();
    expect(root().getAttribute('data-theme')).toBe('custom');
    expect(root().style.getPropertyValue('--theme-bg')).toBe(record.vars.bg);
    expect(root().style.colorScheme).toBe('light');
  });

  it('applies nothing when any value is not a hex colour', () => {
    localStorage.setItem('pc_theme', 'custom');
    localStorage.setItem('pc_theme_custom', JSON.stringify({ v: 1, light: false, vars: { bg: '#000000', surface: 'url(https://example.test/p)' } }));
    runPrePaint();
    expect(root().getAttribute('data-theme')).toBeNull();
    expect(root().style.getPropertyValue('--theme-bg')).toBe('');
  });

  it('survives unparseable storage', () => {
    localStorage.setItem('pc_theme', 'custom');
    localStorage.setItem('pc_theme_custom', '{not json');
    expect(runPrePaint).not.toThrow();
    expect(root().getAttribute('data-theme')).toBeNull();
  });
});

describe('ThemeProvider', () => {
  beforeEach(resetDocument);
  afterEach(cleanup);

  const probe = {};
  const Probe = () => { const value = useTheme(); useEffect(() => { probe.api = value; }); return null; };
  const mount = () => render(<ThemeProvider><Probe /></ThemeProvider>);

  it('moves a legacy alias id to its theme', () => {
    localStorage.setItem('pc_theme', 'glacier');
    mount();
    expect(probe.api.themeId).toBe('nordic-frost');
  });

  it('saves a custom theme, then clears its inline colours when a preset is chosen', () => {
    mount();
    act(() => { probe.api.saveCustomTheme({ bg: '#101418', accent: '#f97316', accent2: '#22d3ee', contrast: 'standard' }); });
    expect(probe.api.themeId).toBe('custom');
    expect(localStorage.getItem('pc_theme')).toBe('custom');
    expect(root().style.getPropertyValue('--theme-accent')).not.toBe('');

    act(() => { probe.api.changeTheme('clean-studio'); });
    expect(root().getAttribute('data-theme')).toBe('clean-studio');
    expect(root().style.getPropertyValue('--theme-accent')).toBe('');
    // The custom theme is kept, so it can be switched back to.
    act(() => { probe.api.changeTheme('custom'); });
    expect(probe.api.themeId).toBe('custom');
  });

  it('rebuilds a custom theme saved under an older schema', () => {
    localStorage.setItem('pc_theme', 'custom');
    localStorage.setItem('pc_theme_custom', JSON.stringify({ v: SCHEMA_VERSION - 1, in: { bg: '#101418', accent: '#f97316' }, light: false, vars: { bg: '#101418' } }));
    mount();
    expect(probe.api.themeId).toBe('custom');
    expect(probe.api.customTheme.v).toBe(SCHEMA_VERSION);
    expect(Object.keys(probe.api.customTheme.vars).length).toBeGreaterThan(1);
  });

  it('falls back to the default when "custom" is stored without a valid theme', () => {
    localStorage.setItem('pc_theme', 'custom');
    mount();
    expect(probe.api.themeId).toBe('powershell');
  });

  it('resets to the default', () => {
    localStorage.setItem('pc_theme', 'riso-print');
    mount();
    act(() => { probe.api.resetTheme(); });
    expect(probe.api.themeId).toBe('powershell');
  });
});
