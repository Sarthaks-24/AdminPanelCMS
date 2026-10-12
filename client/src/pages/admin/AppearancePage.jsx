import React, { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTheme, CUSTOM_THEME_ID } from '../../context/ThemeContext';
import { useToast } from '../../components/admin/Toast';
import ThemeGrid from '../../components/admin/ThemeGrid';
import { deriveTheme, fromShareCode, toShareCode, varsStyle } from '../../theme/derive';
import { deltaE, parseColor } from '../../theme/color';

const HEX = /^#?([0-9a-f]{6})$/i;
const normalise = (value) => { const match = HEX.exec(value.trim()); return match ? `#${match[1].toLowerCase()}` : null; };

const sectionClass = 'rounded-xl border border-t-border bg-t-surface p-5 sm:p-6';
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-focus';

/** A colour well plus a hex field that stay in step. The field accepts `#rrggbb` or `rrggbb`. */
function ColourField({ id, label, hint, value, onChange }) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setText(value); }
  const invalid = normalise(text) === null;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-t-text">{label}</label>
      {hint && <p id={`${id}-hint`} className="text-xs text-t-muted">{hint}</p>}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}, colour picker`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-t-border-hi bg-t-bg p-1"
        />
        <input
          id={id}
          value={text}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => { setText(event.target.value); const next = normalise(event.target.value); if (next) onChange(next); }}
          className="w-full rounded-lg border border-t-border-hi bg-t-bg px-3 py-2 font-mono text-sm text-t-text focus:border-t-accent focus:outline-none"
        />
      </div>
      {invalid && <p className="mt-1 text-xs text-t-danger">Use six hex digits, like #1e293b.</p>}
    </div>
  );
}

/** The dashboard's real building blocks, painted in the draft colours. */
function Preview({ vars }) {
  return (
    <div style={varsStyle(vars)} className="overflow-hidden rounded-lg border border-t-border bg-t-bg text-t-text">
      <div className="flex">
        <div aria-hidden="true" className="hidden w-28 shrink-0 border-r border-t-border bg-t-surface px-3 py-4 text-xs sm:block">
          <p className="text-t-dim">Content</p>
          <p className="mt-2 flex gap-1 font-semibold"><span className="font-mono text-t-accent-br">›</span>Projects</p>
          <p className="mt-1.5 pl-2.5 text-t-muted">Skills</p>
          <p className="mt-1.5 pl-2.5 text-t-muted">Résumé</p>
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="rounded-lg border border-t-border bg-t-surface p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Alpha Trading Engine</p>
              <span className="rounded border border-t-accent2/50 bg-t-accent2-dim px-1.5 py-0.5 text-xs text-t-accent2">Published</span>
            </div>
            <p className="mt-1 text-sm text-t-muted">Low-latency order matching, written in Rust.</p>
            <p className="mt-1 text-xs text-t-dim">Updated 2 days ago</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-md bg-t-accent px-3 py-1.5 text-xs font-semibold text-t-on-accent">Create key</span>
              <span className="rounded-md border border-t-border-hi px-3 py-1.5 text-xs text-t-text">Edit</span>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-md border border-t-border bg-t-code p-2.5 text-xs text-t-text"><code>curl -H "Authorization: Bearer sk_live_8f2c…" /v1/projects</code></pre>
          <p className="rounded-md border border-t-danger/50 bg-t-danger-dim px-3 py-2 text-xs text-t-danger">This key was revoked and no longer works.</p>
          <p className="text-xs text-t-warn">Two projects are still drafts.</p>
        </div>
      </div>
    </div>
  );
}

/** Lists the colours that were moved to stay readable, input beside result. */
function Adjustments({ draft, vars }) {
  const pairs = [['Background', draft.bg, vars.bg], ['Accent', draft.accent, vars.accent], ...(draft.accent2 ? [['Second accent', draft.accent2, vars.accent2]] : [])]
    .filter(([, from, to]) => deltaE(parseColor(from), parseColor(to)) > 0.02);
  if (pairs.length === 0) return <p className="text-xs text-t-muted">Every colour is used as picked.</p>;
  return (
    <div className="text-xs text-t-muted">
      <p>Adjusted so text stays readable:</p>
      <ul className="mt-1.5 space-y-1">
        {pairs.map(([name, from, to]) => (
          <li key={name} className="flex items-center gap-2">
            <span className="w-24">{name}</span>
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm border border-t-border-hi" style={{ backgroundColor: from }} />
            <span className="font-mono">{from}</span>
            <span aria-hidden="true">to</span>
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm border border-t-border-hi" style={{ backgroundColor: to }} />
            <span className="font-mono">{to}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AppearancePage() {
  const { theme, themeId, customTheme, saveCustomTheme, resetTheme } = useTheme();
  const { notify } = useToast();
  const [draft, setDraft] = useState(() => customTheme?.in ?? { bg: theme.preview[0], accent: theme.preview[1], accent2: theme.preview[2], contrast: 'standard' });
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [copied, setCopied] = useState(false);

  const derived = useMemo(() => deriveTheme(draft), [draft]);
  const code = toShareCode(draft);
  const set = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));

  const apply = () => { saveCustomTheme(draft); notify('Custom theme applied.', 'success'); };
  const startFromCurrent = () => setDraft((current) => ({ ...current, bg: theme.preview[0], accent: theme.preview[1], accent2: theme.preview[2] }));
  const loadCode = (event) => {
    event.preventDefault();
    const input = fromShareCode(pasted);
    if (!input) { setPasteError('That is not a theme code. Codes look like pc1:0c1017.2563eb.10b981.s'); return; }
    setPasteError(''); setPasted(''); setDraft(input);
  };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { notify('Copy failed. Select the code and copy it by hand.'); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl">Appearance</h1>
        <p className="mt-2 text-sm text-t-muted">Themes are saved in this browser, so another device or browser keeps its own choice.</p>
      </header>

      <section aria-labelledby="themes-title" className={sectionClass}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="themes-title" className="text-base font-semibold">Theme</h2>
          <button type="button" onClick={resetTheme} className={`rounded px-1.5 py-1 text-sm text-t-muted hover:text-t-text ${focusRing}`}>Reset to default</button>
        </div>
        <ThemeGrid />
      </section>

      <section aria-labelledby="custom-title" className={sectionClass}>
        <h2 id="custom-title" className="text-base font-semibold">Make your own</h2>
        <p className="mt-1 text-sm text-t-muted">Pick a background and an accent. Every other colour is worked out from them, and any colour that would make text hard to read is adjusted.</p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            <ColourField id="custom-bg" label="Background" hint="Dark or light: the rest follows from it." value={draft.bg} onChange={set('bg')} />
            <ColourField id="custom-accent" label="Accent" hint="Buttons, links and the current page." value={draft.accent} onChange={set('accent')} />
            <ColourField id="custom-accent2" label="Second accent" hint="Published badges and success marks." value={draft.accent2 || derived.vars.accent2} onChange={set('accent2')} />

            <fieldset>
              <legend className="text-sm font-medium text-t-text">Contrast</legend>
              <div className="mt-1.5 inline-flex rounded-lg border border-t-border bg-t-bg p-0.5">
                {[['standard', 'Standard'], ['high', 'High']].map(([value, text]) => (
                  <label key={value} className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-t-focus ${draft.contrast === value ? 'bg-t-surface-hi text-t-text' : 'text-t-muted hover:text-t-text'}`}>
                    <input type="radio" name="custom-contrast" value={value} checked={draft.contrast === value} onChange={() => set('contrast')(value)} className="sr-only" />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>

            <Adjustments draft={draft} vars={derived.vars} />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" onClick={apply} className={`rounded-lg bg-t-accent px-4 py-2 text-sm font-semibold text-t-on-accent hover:bg-t-accent-br ${focusRing}`}>
                {themeId === CUSTOM_THEME_ID ? 'Update my theme' : 'Use this theme'}
              </button>
              <button type="button" onClick={startFromCurrent} className={`rounded px-1.5 py-1 text-sm text-t-muted hover:text-t-text ${focusRing}`}>Start from the current theme</button>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <p className="text-xs font-medium text-t-dim">Preview</p>
            <Preview vars={derived.vars} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="share-code" className="text-sm font-medium text-t-text">Theme code</label>
                <p className="text-xs text-t-muted">Share it, or keep it to restore these colours later.</p>
                <div className="mt-1.5 flex gap-2">
                  <input id="share-code" readOnly value={code} onFocus={(event) => event.target.select()} className="w-full min-w-0 rounded-lg border border-t-border bg-t-bg px-3 py-2 font-mono text-xs text-t-text" />
                  <button type="button" onClick={copyCode} aria-label={copied ? 'Copied' : 'Copy theme code'} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-t-border-hi px-3 text-xs text-t-text hover:border-t-accent ${focusRing}`}>
                    {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <form onSubmit={loadCode}>
                <label htmlFor="paste-code" className="text-sm font-medium text-t-text">Use a code</label>
                <p className="text-xs text-t-muted">Loads it into the editor; nothing changes until you apply it.</p>
                <div className="mt-1.5 flex gap-2">
                  <input id="paste-code" value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="pc1:…" spellCheck={false} aria-invalid={Boolean(pasteError)} aria-describedby={pasteError ? 'paste-error' : undefined} className="w-full min-w-0 rounded-lg border border-t-border-hi bg-t-bg px-3 py-2 font-mono text-xs text-t-text placeholder:text-t-dim focus:border-t-accent focus:outline-none" />
                  <button type="submit" className={`shrink-0 rounded-lg border border-t-border-hi px-3 text-xs text-t-text hover:border-t-accent ${focusRing}`}>Load</button>
                </div>
                {pasteError && <p id="paste-error" role="alert" className="mt-1 text-xs text-t-danger">{pasteError}</p>}
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
