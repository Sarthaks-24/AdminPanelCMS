// Reads the theme blocks out of index.css text. Used by the tests (and nothing at runtime): the
// stylesheet stays the source of truth for preset colours, so the checks read what ships.

const BLOCK = /((?:(?::root|\[data-theme="[a-z0-9-]+"\])\s*,?\s*)+)\{([^}]*--theme-bg[^}]*)\}/g;

/** @returns {Array<{ ids: string[], vars: Record<string,string> }>} ids[0] is the theme, the rest are aliases */
export function parseThemeBlocks(css) {
  const blocks = [];
  for (const match of css.matchAll(BLOCK)) {
    const ids = [...match[1].matchAll(/data-theme="([a-z0-9-]+)"/g)].map((m) => m[1]);
    const vars = Object.fromEntries([...match[2].matchAll(/--theme-([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    blocks.push({ ids, vars });
  }
  return blocks;
}
