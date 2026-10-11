// The project slug rule, matching the server (server/lib/modelConstants.js: SLUG_PATTERN
// /^[a-z0-9]+(-[a-z0-9]+)*$/, SLUG_MAX_LENGTH 80), so a generated slug is never rejected on save.
export const SLUG_MAX_LENGTH = 80;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * NFKD-normalise, strip diacritics, lower-case, every run of other characters → '-', trim dashes,
 * cut to 80 characters (and trim again). Empty input gives `fallback`.
 */
export function slugify(text, fallback = 'project') {
  const slug = String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug || fallback;
}

/**
 * The same rule while the owner types in the slug field: a trailing separator becomes one dash so a
 * dash can be typed, and empty stays empty. The submit runs `slugify` on the result.
 */
export function slugifyTyping(text) {
  const slug = slugify(text, '');
  const trailing = slug && /[^a-zA-Z0-9]$/.test(String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')) ? '-' : '';
  return slug.length < SLUG_MAX_LENGTH ? slug + trailing : slug;
}
