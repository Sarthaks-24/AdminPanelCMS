import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { resolveDocLink } from '../../content/docs';
import { REPO_URL } from '../../content/site';

// GitHub's own anchor rule, so a #fragment copied out of the repo still lands here.
export const slugifyHeading = (text) => String(text)
  .toLowerCase()
  .replace(/[^\w\- ]+/g, '')
  .trim()
  .replace(/\s+/g, '-');

const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
};

function heading(level) {
  const Tag = `h${level}`;
  return function Heading({ children }) {
    const id = slugifyHeading(textOf(children));
    return (
      <Tag id={id} className="group scroll-mt-20">
        {children}
        {/* The glyph is decoration; the accessible name carries the meaning, so it is not read as
            part of the heading text. */}
        <a href={`#${id}`} aria-label="Permalink to this section" className="ml-2 align-middle text-t-dim no-underline opacity-0 transition group-hover:opacity-100 focus:opacity-100">
          <span aria-hidden="true">#</span>
        </a>
      </Tag>
    );
  };
}

/** Strips the inline markdown that would otherwise end up in a heading's text and its id. */
const plainHeading = (text) => text
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images keep their label
  .replace(/[`*_~]/g, '')
  .trim();

/**
 * Extracts the `##` and `###` headings so a page can build its own table of contents.
 * Lines inside fenced code blocks are skipped: a shell comment like `## install` is not a heading,
 * and the rendered document has no anchor for it.
 */
export function outlineOf(markdown) {
  const outline = [];
  let fence = null;
  for (const line of markdown.split('\n')) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!heading) continue;
    const text = plainHeading(heading[2]);
    if (!text) continue;
    // Deliberately not de-duplicated: the id has to be the one the rendered heading carries, and
    // that is derived from its text alone. Two identical headings share an anchor and the link
    // lands on the first, which beats a suffixed id that matches no element at all.
    outline.push({ depth: heading[1].length, text, id: slugifyHeading(text) });
  }
  return outline;
}

export default function Markdown({ children, source = '' }) {
  const components = useMemo(() => ({
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    a({ href, children: label, ...rest }) {
      const target = resolveDocLink(href, REPO_URL, source);
      if (target?.startsWith('/')) {
        const [path, hash] = target.split('#');
        return <Link to={{ pathname: path, hash: hash ? `#${hash}` : '' }} {...rest}>{label}</Link>;
      }
      const external = /^https?:/i.test(target || '');
      return <a href={target} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})} {...rest}>{label}</a>;
    },
    // Tables in these docs are wide; let them scroll instead of breaking the column.
    table({ children: rows }) {
      return <div className="doc-table-scroll"><table>{rows}</table></div>;
    },
  }), [source]);

  return (
    <div className="doc-prose">
      {/* Raw HTML in the source is not rendered: react-markdown ignores it unless rehype-raw is added. */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>
    </div>
  );
}
