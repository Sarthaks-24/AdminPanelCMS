import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { File, Folder, RotateCcw } from 'lucide-react';
import JsonBlock from './JsonBlock';
import { SECTIONS, buildDefaultScope, defaultFieldsFor, fakeEtag, responseHeaders, scopedResponse } from '../../content/scopeDemo';

const ENDPOINTS = [
  { key: 'profile', path: '/v1/profile' },
  { key: 'projects', path: '/v1/projects' },
  { key: 'skills', path: '/v1/skills' },
  { key: 'fs', path: '/v1/fs' },
];

const TOKEN_KINDS = [
  { value: 'pk', label: 'pk_live', title: 'A publishable key: safe to ship in a browser bundle, limited to origins you allow.' },
  { value: 'sk', label: 'sk_live', title: 'A secret key: for your own server only, never shipped to a browser.' },
];

function Checkbox({ checked, onChange, children, dim = false, id }) {
  return (
    <label htmlFor={id} className="group flex cursor-pointer items-center gap-2.5 rounded-md py-[0.1875rem] pl-0.5 pr-2 hover:bg-t-surface-hi/60">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--theme-accent)]"
      />
      <span className={`truncate ${checked ? (dim ? 'text-t-muted' : 'text-t-text') : 'text-t-dim line-through decoration-t-dim/50'}`}>
        {children}
      </span>
    </label>
  );
}

function FsNode({ node, depth, onPick, picked }) {
  if (node.type === 'directory') {
    return (
      <div>
        {node.path !== '/' && (
          <div className="flex items-center gap-2 py-1 text-t-muted" style={{ paddingLeft: `${depth * 0.875}rem` }}>
            <Folder size={13} className="shrink-0 text-t-accent" aria-hidden="true" />
            <span className="font-mono-code text-[0.75rem]">{node.name}/</span>
          </div>
        )}
        {node.children.map((child) => (
          <FsNode key={child.path} node={child} depth={node.path === '/' ? 0 : depth + 1} onPick={onPick} picked={picked} />
        ))}
      </div>
    );
  }
  const isPicked = picked === node.path;
  return (
    <button
      type="button"
      onClick={() => onPick(node)}
      className={`flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left transition ${isPicked ? 'bg-t-accent/12 text-t-text' : 'text-t-muted hover:bg-t-surface-hi/60 hover:text-t-text'}`}
      style={{ paddingLeft: `${depth * 0.875 + 0.25}rem` }}
    >
      <File size={13} className="shrink-0 text-t-dim" aria-hidden="true" />
      <span className="flex-1 truncate font-mono-code text-[0.75rem]">{node.name}</span>
      <span className="shrink-0 font-mono-code text-[0.6875rem] text-t-dim">{node.size}B</span>
    </button>
  );
}

function firstFile(node) {
  if (node.type === 'file') return node;
  for (const child of node.children || []) {
    const found = firstFile(child);
    if (found) return found;
  }
  return null;
}

export default function ScopeDemo() {
  const [scope, setScope] = useState(buildDefaultScope);
  const [endpoint, setEndpoint] = useState('projects');
  const [tokenType, setTokenType] = useState('pk');
  const [openFile, setOpenFile] = useState(null);

  const response = useMemo(() => scopedResponse(endpoint, scope), [endpoint, scope]);
  const etag = useMemo(() => fakeEtag(response.body), [response.body]);

  const toggleSection = (key) => setScope((current) => ({
    ...current,
    [key]: { ...current[key], enabled: !current[key].enabled },
  }));

  const toggleField = (key, field) => setScope((current) => {
    const fields = current[key].fields || [];
    const next = fields.includes(field) ? fields.filter((item) => item !== field) : [...fields, field];
    return { ...current, [key]: { ...current[key], fields: next } };
  });

  // Counts what each section will actually serve, so an empty field list reports its fallback set
  // rather than zero while the response beside it is showing ten fields.
  const grantedCount = SECTIONS.reduce((total, section) => {
    if (!scope[section.key].enabled) return total;
    const picked = scope[section.key].fields;
    if (picked === null) return total + 1;
    return total + (picked.length || (defaultFieldsFor(section) || []).length);
  }, 0);
  const isDefault = JSON.stringify(scope) === JSON.stringify(buildDefaultScope());

  const fsTree = endpoint === 'fs' && response.status === 200 ? response.body : null;
  const shownFile = fsTree ? (openFile && findByPath(fsTree, openFile)) || firstFile(fsTree) : null;

  return (
    <section aria-labelledby="demo-title" className="overflow-hidden rounded-xl border border-t-border bg-t-surface">
      {/* The app whose grant is being edited, and which of its two token kinds is calling. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-t-border bg-t-surface-hi/50 px-4 py-3">
        <h2 id="demo-title" className="text-[0.875rem] font-semibold text-t-text">
          App <span className="font-mono-code font-medium text-t-accent">portfolio-site</span>
        </h2>
        <p className="text-[0.8125rem] text-t-muted">grants {grantedCount} field{grantedCount === 1 ? '' : 's'}</p>
        <div className="ml-auto flex items-center gap-2">
          {!isDefault && (
            <button
              type="button"
              onClick={() => { setScope(buildDefaultScope()); setOpenFile(null); }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.75rem] text-t-muted transition hover:text-t-text"
            >
              <RotateCcw size={13} aria-hidden="true" />Reset
            </button>
          )}
          {/* Plain toggle buttons: a radiogroup role would promise arrow-key navigation this does not implement. */}
          <div className="flex items-center gap-2">
            <span id="token-kind-label" className="text-[0.75rem] text-t-dim">Called with</span>
            <div className="flex rounded-lg border border-t-border p-0.5">
              {TOKEN_KINDS.map(({ value, label, title }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tokenType === value}
                  aria-describedby="token-kind-label"
                  title={title}
                  onClick={() => setTokenType(value)}
                  className={`rounded-md px-2.5 py-1 font-mono-code text-[0.75rem] transition ${tokenType === value ? 'bg-t-accent text-t-on-accent' : 'text-t-muted hover:text-t-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[17rem_1fr]">
        {/* ── The grant ─────────────────────────────────────────────── */}
        <div className="border-b border-t-border p-4 lg:border-b-0 lg:border-r">
          <h3 className="text-[0.8125rem] font-semibold text-t-text">What this app may read</h3>
          <p className="mt-1.5 mb-3 text-[0.8125rem] leading-5 text-t-muted">
            Untick a field and watch it vanish from the response on the right — that response is everything the
            website holding this key can ever see.
          </p>
          <div className="space-y-3">
            {SECTIONS.map((section) => (
              <div key={section.key}>
                <div className="text-[0.8125rem] font-medium">
                  <Checkbox id={`grant-${section.key}`} checked={scope[section.key].enabled} onChange={() => toggleSection(section.key)}>
                    <span className="font-mono-code">{section.key}</span>
                  </Checkbox>
                </div>
                {scope[section.key].enabled && section.fields && (
                  <div className="ml-[0.3125rem] mt-0.5 border-l border-t-border pl-3 text-[0.75rem]">
                    {section.fields.map((field) => (
                      <Checkbox
                        key={field}
                        id={`grant-${section.key}-${field}`}
                        dim
                        checked={(scope[section.key].fields || []).includes(field)}
                        onChange={() => toggleField(section.key, field)}
                      >
                        <span className="font-mono-code">{field}</span>
                      </Checkbox>
                    ))}
                  </div>
                )}
                {scope[section.key].enabled && !section.fields && (
                  <p className="ml-[0.3125rem] mt-0.5 border-l border-t-border pl-3 text-[0.75rem] leading-5 text-t-dim">{section.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── What the app receives ─────────────────────────────────── */}
        <div className="min-w-0">
          <div role="group" aria-label="Endpoint to call" className="flex gap-1 overflow-x-auto border-b border-t-border px-2 pt-2">
            {ENDPOINTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setEndpoint(item.key)}
                aria-pressed={endpoint === item.key}
                className={`shrink-0 rounded-t-lg border-b-2 px-3 py-2 font-mono-code text-[0.75rem] transition ${
                  endpoint === item.key ? 'border-t-accent text-t-text' : 'border-transparent text-t-dim hover:text-t-muted'
                }`}
              >
                {item.path}
              </button>
            ))}
          </div>

          {/* Announced, because the whole point of the panel is that this line and the body below it change. */}
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 font-mono-code text-[0.6875rem]">
            <span className={response.status === 200 ? 'text-t-accent2' : 'text-t-danger'}>
              {response.status} {response.status === 200 ? 'OK' : 'Forbidden'}
            </span>
            {response.status === 200 && responseHeaders(tokenType, etag).map(([name, value]) => (
              <span key={name} className="text-t-dim"><span className="text-t-muted">{name}:</span> {value}</span>
            ))}
          </div>

          {response.usedDefaults && (
            <p className="mx-4 mb-3 rounded-lg border border-t-accent/25 bg-t-accent/8 px-3 py-2 text-[0.75rem] leading-5 text-t-muted">
              Every box is unticked, which is not the same as granting nothing: an empty field list means
              &ldquo;use this section&rsquo;s defaults&rdquo;, so the defaults are what you see. To grant nothing, switch the
              section itself off.
            </p>
          )}

          {response.status !== 200 ? (
            <div className="px-4 pb-4">
              <p className="mb-2 text-[0.8125rem] leading-6 text-t-muted">
                The section is off, so the endpoint is closed to this app. Not an empty array — a refusal, with the reason in it.
              </p>
              <JsonBlock value={response.body} className="rounded-lg border border-t-danger/30" />
            </div>
          ) : endpoint === 'fs' ? (
            <div className="grid gap-px bg-t-border sm:grid-cols-[14rem_1fr]">
              <div className="min-h-[18rem] bg-t-surface p-2">
                {fsTree.children.length ? (
                  <FsNode node={fsTree} depth={0} onPick={(node) => setOpenFile(node.path)} picked={shownFile?.path} />
                ) : (
                  <p className="p-2 text-[0.8125rem] leading-6 text-t-dim">Every section is off, so the tree is empty.</p>
                )}
              </div>
              <div className="min-w-0 bg-t-surface">
                {shownFile ? (
                  <>
                    <p className="px-4 py-2.5 font-mono-code text-[0.6875rem] text-t-muted">
                      <span className="text-t-accent2">$</span> cat {shownFile.path}
                    </p>
                    <JsonBlock
                      value={typeof shownFile.content === 'string' ? shownFile.content : JSON.stringify(shownFile.content, null, 2)}
                      className="min-h-[14rem] whitespace-pre-wrap"
                    />
                  </>
                ) : (
                  <p className="p-4 text-[0.8125rem] leading-6 text-t-dim">Nothing granted, nothing to read.</p>
                )}
              </div>
            </div>
          ) : (
            <JsonBlock value={response.body} className="max-h-[28rem] min-h-[18rem]" />
          )}
        </div>
      </div>

      <p className="border-t border-t-border px-4 py-2.5 text-[0.75rem] leading-5 text-t-dim">
        A demo, not a live API: the content is invented, and the scoping and file tree are a faithful
        reimplementation of the server&rsquo;s rules rather than the server itself. Field names, the 403 body and the
        cache headers are the real ones; the ETag is a stand-in. The{' '}
        <Link to="/docs/api" className="text-t-muted underline decoration-t-dim underline-offset-2 hover:text-t-text">API reference</Link>{' '}
        documents what a real call returns.
      </p>
    </section>
  );
}

function findByPath(node, path) {
  if (node.path === path && node.type === 'file') return node;
  for (const child of node.children || []) {
    const found = findByPath(child, path);
    if (found) return found;
  }
  return null;
}
