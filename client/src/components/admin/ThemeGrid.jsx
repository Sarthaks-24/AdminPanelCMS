import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Search } from 'lucide-react';
import { CUSTOM_THEME_ID, useTheme } from '../../context/ThemeContext';
import { APPEARANCE } from '../../lib/routes';
import { varsStyle } from '../../theme/derive';

/**
 * A small drawing of the dashboard in a theme's colours. Each thumbnail carries its own `data-theme`
 * (or inline vars for a custom theme), so it previews itself without repainting the page.
 */
export function ThemeThumbnail({ themeId, vars, className = '' }) {
  return (
    <span
      aria-hidden="true"
      data-theme={vars ? undefined : themeId}
      style={vars ? varsStyle(vars) : undefined}
      className={`flex h-14 overflow-hidden rounded-md border border-t-border bg-t-bg ${className}`}
    >
      <span className="flex w-[28%] flex-col gap-1 border-r border-t-border bg-t-surface p-1.5">
        <span className="h-1 w-3/4 rounded-full bg-t-accent" />
        <span className="h-1 w-full rounded-full bg-t-dim/60" />
        <span className="h-1 w-2/3 rounded-full bg-t-dim/60" />
        <span className="h-1 w-5/6 rounded-full bg-t-dim/60" />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-1.5 w-3/5 rounded-full bg-t-text" />
        <span className="h-1 w-4/5 rounded-full bg-t-muted/70" />
        <span className="mt-auto flex items-center gap-1">
          <span className="h-2.5 w-7 rounded-sm bg-t-accent" />
          <span className="h-2.5 w-2.5 rounded-full bg-t-accent2" />
        </span>
      </span>
    </span>
  );
}

const FILTERS = [['all', 'All'], ['dark', 'Dark'], ['light', 'Light']];

/**
 * Every preset plus the custom slot, filterable by light/dark and searchable by name or description.
 * Choosing applies at once; `onChoose` lets a popover close itself afterwards.
 */
export default function ThemeGrid({ onChoose, onNavigate, compact = false }) {
  const { themeId, changeTheme, customTheme, themes, groups } = useTheme();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const gridRef = useRef(null);

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase();
    return groups.map((group) => ({
      group,
      items: Object.values(themes).filter((theme) => theme.group === group
        && (filter === 'all' || (filter === 'light') === theme.isLight)
        && (!words || `${theme.label} ${theme.description} ${theme.group}`.toLowerCase().includes(words))),
    })).filter(({ items }) => items.length > 0);
  }, [groups, themes, filter, query]);

  const choose = (id) => { changeTheme(id); onChoose?.(); };

  // Arrow keys move between cards; Enter or Space chooses. Moving never repaints the page.
  const onKeyDown = (event) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys) && event.key !== 'Home' && event.key !== 'End') return;
    const cards = [...(gridRef.current?.querySelectorAll('[data-theme-card]') || [])];
    const index = cards.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : Math.min(cards.length - 1, Math.max(0, index + keys[event.key]));
    cards[next]?.focus();
  };

  const cardClass = (selected) => `group flex w-full cursor-pointer flex-col gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-focus ${
    selected ? 'border-t-accent bg-t-surface-hi' : 'border-t-border hover:border-t-border-hi hover:bg-t-surface-hi'
  }`;
  const label = (text, selected) => (
    <span className="flex min-w-0 items-center gap-1.5 px-0.5 text-[0.8125rem]">
      <span className={`min-w-0 flex-1 truncate ${selected ? 'font-semibold text-t-text' : 'text-t-muted group-hover:text-t-text'}`}>{text}</span>
      {selected && <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-t-text"><Check size={12} aria-hidden="true" className="text-t-accent-br" />Current</span>}
    </span>
  );
  const columns = compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  const customSelected = themeId === CUSTOM_THEME_ID;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="inline-flex rounded-lg border border-t-border bg-t-bg p-0.5">
          {FILTERS.map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === value ? 'bg-t-surface-hi text-t-text' : 'text-t-muted hover:text-t-text'}`}
            >{text}</button>
          ))}
        </div>
        <label className="relative min-w-[10rem] flex-1">
          <span className="sr-only">Search themes</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-t-dim" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search themes"
            className="w-full rounded-lg border border-t-border bg-t-bg py-1.5 pl-8 pr-2.5 text-sm text-t-text placeholder:text-t-dim focus:border-t-accent focus:outline-none"
          />
        </label>
      </div>

      <div ref={gridRef} onKeyDown={onKeyDown} className="mt-3 space-y-4">
        {!query && (
          <section aria-label="Your own">
            <h3 className="mb-1.5 text-xs font-medium text-t-dim">Your own</h3>
            <ul className={`grid gap-2 ${columns}`}>
              <li>
                {customTheme ? (
                  <button type="button" data-theme-card aria-pressed={customSelected} onClick={() => choose(CUSTOM_THEME_ID)} className={cardClass(customSelected)}>
                    <ThemeThumbnail vars={customTheme.vars} />
                    {label('Custom', customSelected)}
                  </button>
                ) : (
                  <Link to={APPEARANCE} data-theme-card onClick={onNavigate} className={`${cardClass(false)} border-dashed`}>
                    <span aria-hidden="true" className="grid h-14 place-items-center rounded-md border border-dashed border-t-border-hi text-lg text-t-dim">+</span>
                    {label('Make your own', false)}
                  </Link>
                )}
              </li>
            </ul>
          </section>
        )}
        {visible.map(({ group, items }) => (
          <section key={group} aria-label={`${group} themes`}>
            <h3 className="mb-1.5 text-xs font-medium text-t-dim">{group}</h3>
            <ul className={`grid gap-2 ${columns}`}>
              {items.map((theme) => {
                const selected = theme.id === themeId;
                return (
                  <li key={theme.id}>
                    <button
                      type="button"
                      data-theme-card
                      aria-pressed={selected}
                      aria-label={`${theme.label}: ${theme.description}`}
                      title={theme.description}
                      onClick={() => choose(theme.id)}
                      className={cardClass(selected)}
                    >
                      <ThemeThumbnail themeId={theme.id} />
                      {label(theme.label, selected)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {visible.length === 0 && <p className="py-6 text-center text-sm text-t-muted">No theme matches “{query}”.</p>}
      </div>
    </div>
  );
}
