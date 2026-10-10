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
        <a href={`#${id}`} aria-label={`Link to this section`} className="ml-2 align-middle text-t-dim opacity-0 transition group-hover:opacity-100 focus:opacity-100">#</a>
      </Tag>
    );
  };
}

/** Extracts the `##` and `###` headings so a page can build its own table of contents. */
export function outlineOf(markdown) {
  return [...markdown.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map(([, hashes, text]) => ({
    depth: hashes.length,
    text: text.replace(/`/g, ''),
    id: slugifyHeading(text.replace(/`/g, '')),
  }));
}

export default function Markdown({ children }) {
  const components = useMemo(() => ({
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    a({ href, children: label, ...rest }) {
      const target = resolveDocLink(href, REPO_URL);
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
  }), []);

  return (
    <div className="doc-prose">
      {/* Raw HTML in the source is not rendered: react-markdown ignores it unless rehype-raw is added. */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>
    </div>
  );
}
