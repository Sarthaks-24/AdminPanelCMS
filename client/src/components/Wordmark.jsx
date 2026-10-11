import React from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../content/site';

/**
 * The one mark the product uses everywhere: public header, auth pages, sign-in and the dashboard.
 * A pool and the two narrower views drawn from it: the product's own shape, not a generic glyph.
 *
 * `to` is where it links (home for visitors, the Overview inside the dashboard). `subtitle` adds a
 * small line under the name. `size="lg"` is the larger variant used on the sign-in panel.
 */
export function WordmarkGlyph({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
      <rect x="1" y="2" width="22" height="7" rx="2" fill="var(--theme-accent)" />
      <rect x="1" y="12" width="13" height="4" rx="1.5" fill="var(--theme-text-dim)" />
      <rect x="1" y="18" width="18" height="4" rx="1.5" fill="var(--theme-text-dim)" />
    </svg>
  );
}

export default function Wordmark({ to = '/', subtitle, size = 'md', className = '', onClick, label }) {
  const large = size === 'lg';
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={label}
      className={`group inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent ${className}`}
    >
      <WordmarkGlyph className={large ? 'h-8 w-8' : 'h-6 w-6'} />
      <span className="min-w-0">
        <span className={`block font-display font-semibold tracking-tight text-t-text ${large ? 'text-lg' : 'text-[0.9375rem]'}`}>{SITE.name}</span>
        {subtitle && <span className="block text-xs text-t-muted">{subtitle}</span>}
      </span>
    </Link>
  );
}
