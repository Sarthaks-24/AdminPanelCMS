import { describe, it, expect } from 'vitest';
import { slugify, slugifyTyping, SLUG_PATTERN } from './slug';

// CB-13: the client generator must only produce slugs the server accepts.
describe('slugify', () => {
  it('folds diacritics and joins words with single dashes', () => {
    expect(slugify('Café Résumé — Über_tool v2!')).toBe('cafe-resume-uber-tool-v2');
  });

  it('cuts to 80 characters without a trailing dash', () => {
    expect(slugify(`${'a'.repeat(79)} b`)).toBe('a'.repeat(79));
    const long = slugify('word '.repeat(40));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long).toMatch(SLUG_PATTERN);
  });

  it('falls back when nothing usable is left', () => {
    expect(slugify('日本語')).toBe('project');
    expect(slugify('  --  ')).toBe('project');
    expect(slugify('', 'item')).toBe('item');
  });

  it('lets a dash be typed in the slug field', () => {
    expect(slugifyTyping('my ')).toBe('my-');
    expect(slugifyTyping('my-')).toBe('my-');
    expect(slugifyTyping('')).toBe('');
    expect(slugify(slugifyTyping('my-'))).toBe('my');
  });
});
