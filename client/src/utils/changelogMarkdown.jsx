import React from 'react';

function parseInline(text, keyPrefix) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={`${keyPrefix}-t${i++}`}>{text.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${keyPrefix}-b${i++}`} className="font-semibold text-[var(--text)]">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code
          key={`${keyPrefix}-c${i++}`}
          className="rounded bg-[var(--bg4)] px-1.5 py-0.5 text-[12px] text-[var(--accent1)]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(
        <em key={`${keyPrefix}-i${i++}`} className="text-[var(--text2)]">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push(<span key={`${keyPrefix}-end`}>{text.slice(last)}</span>);
  }
  return parts.length ? parts : text;
}

/**
 * Safe subset markdown → React (no HTML injection).
 */
export function renderChangelogMarkdown(md) {
  if (!md) return null;
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let listItems = [];
  let blockKey = 0;

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`ul-${blockKey++}`} className="changelog-md-list my-2 space-y-2 pl-1">
        {listItems.map((item, idx) => (
          <li key={idx} className="flex gap-2 text-[13px] leading-6 text-[var(--text2)]">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent1)]" />
            <span>{parseInline(item, `li-${blockKey}-${idx}`)}</span>
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      flushList();
      const text = trimmed.replace(/^###\s+/, '');
      blocks.push(
        <h4 key={`h3-${blockKey++}`} className="changelog-md-h3 mt-3 font-cinzel text-[15px] font-bold text-[var(--gold)]">
          {parseInline(text, `h3-${blockKey}`)}
        </h4>,
      );
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      flushList();
      const text = trimmed.replace(/^##\s+/, '');
      blocks.push(
        <h3 key={`h2-${blockKey++}`} className="changelog-md-h2 mt-4 font-cinzel text-[17px] font-bold tracking-wide text-[var(--gold)]">
          {parseInline(text, `h2-${blockKey}`)}
        </h3>,
      );
      continue;
    }

    if (/^>\s+/.test(trimmed)) {
      flushList();
      const text = trimmed.replace(/^>\s+/, '');
      blocks.push(
        <div
          key={`quote-${blockKey++}`}
          className="my-2 rounded-lg border-l-2 border-[var(--accent1)] bg-[var(--bg4)]/60 px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent1)]"
        >
          {parseInline(text, `q-${blockKey}`)}
        </div>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blockKey++}`} className="changelog-md-p my-2 text-[13px] leading-7 text-[var(--text2)]">
        {parseInline(trimmed, `p-${blockKey}`)}
      </p>,
    );
  }

  flushList();
  return blocks;
}