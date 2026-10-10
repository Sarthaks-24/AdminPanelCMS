import React from 'react';

// Matches a string (and whether it is followed by a colon, making it a key), a literal, or a number.
// Built fresh per call: a shared /g regex carries lastIndex between calls.
const token = () => /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;

const CLASS = {
  key: 'text-t-text',
  string: 'text-t-accent2',
  literal: 'text-t-accent-br',
  number: 'text-t-accent-br',
};

function highlight(source) {
  const pattern = token();
  const parts = [];
  let last = 0;
  let index = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match.index > last) parts.push(source.slice(last, match.index));
    const [whole, string, colon, literal, number] = match;
    if (string) {
      parts.push(<span key={index} className={colon ? CLASS.key : CLASS.string}>{string}</span>);
      if (colon) parts.push(colon);
    } else {
      parts.push(<span key={index} className={literal ? CLASS.literal : CLASS.number}>{literal || number}</span>);
    }
    last = match.index + whole.length;
    index += 1;
  }
  if (last < source.length) parts.push(source.slice(last));
  return parts;
}

/** A JSON response body, coloured so the shape reads at a glance. Theme tokens only. */
export default function JsonBlock({ value, className = '' }) {
  const source = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <pre className={`overflow-auto bg-t-code p-4 font-mono-code text-[0.75rem] leading-[1.7] text-t-dim ${className}`}>
      <code>{highlight(source)}</code>
    </pre>
  );
}
