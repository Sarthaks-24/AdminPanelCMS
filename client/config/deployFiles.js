// Vite plugins that turn the build inputs (config/buildEnv.js) into the deploy files, so the domain,
// the API origin and the product name are never hand-edited into static files.
//
//  - siteHtml: fills %SITE_URL% and %SITE_NAME% in index.html (canonical URL, social cards, title).
//  - deployFiles (build only):
//      * injects the CSP as a <meta> before the first script in index.html;
//      * writes dist/_headers from public/_headers, replacing %CSP% with the header policy;
//      * writes dist/.well-known/security.txt from its template, with the domain and an Expires one
//        year from the build date.
// scripts/check-dist.mjs then fails the build on any %TOKEN% left behind.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cspHeader, cspMeta } from './csp.js';
import { siteUrl } from './buildEnv.js';

export const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).filter((body) => body.trim());
export const sha256 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
export const LEFTOVER_TOKEN = /%[A-Z][A-Z0-9_]*%/g;

const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fillSiteTokens(html, site) {
  return html.replaceAll('%SITE_URL%', siteUrl(site)).replaceAll('%SITE_NAME%', escapeHtml(site.name));
}

export const siteHtml = ({ site }) => ({
  name: 'site-html',
  transformIndexHtml: { order: 'pre', handler: (html) => fillSiteTokens(html, site) },
});

/** Puts the CSP meta right before the first <script> (so it governs every script), else before </head>. */
export function injectCspMeta(html, policy) {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(policy)}" />`;
  const at = html.search(/<script\b/i);
  if (at !== -1) return `${html.slice(0, at)}${tag}\n    ${html.slice(at)}`;
  return html.replace(/<\/head>/i, `  ${tag}\n  </head>`);
}

export function securityTxt(template, { site, now }) {
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const domain = site.domain || '[your-domain]';
  return template.replaceAll('%SITE_DOMAIN%', domain).replaceAll('%SITE_NAME%', site.name).replaceAll('%EXPIRES%', expires.toISOString());
}

export function deployFiles({ apiOrigin, site, publicDir, now = new Date() }) {
  let outDir;
  let scriptHashes = [];
  return {
    name: 'deploy-files',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        scriptHashes = inlineScripts(html).map(sha256);
        return injectCspMeta(html, cspMeta({ apiOrigin, scriptHashes }));
      },
    },
    // After Vite has copied public/: overwrite the copied templates with the filled-in files.
    closeBundle() {
      const headers = readFileSync(path.join(publicDir, '_headers'), 'utf8').replaceAll('%CSP%', cspHeader({ apiOrigin, scriptHashes }));
      writeFileSync(path.join(outDir, '_headers'), headers);
      const wellKnown = path.join(outDir, '.well-known');
      mkdirSync(wellKnown, { recursive: true });
      const template = readFileSync(path.join(publicDir, '.well-known', 'security.txt'), 'utf8');
      writeFileSync(path.join(wellKnown, 'security.txt'), securityTxt(template, { site, now }));
    },
  };
}
