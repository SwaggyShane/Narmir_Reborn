import React from 'react';
import clsx from 'clsx';
import { renderChangelogMarkdown } from '../../utils/changelogMarkdown.jsx';
import { formatTimestampShort } from '../../utils/timestamp.js';

const CATEGORY_STYLES = {
  combat: { accent: 'from-red-600/80 to-orange-500/40', badge: 'bg-red-950/50 text-red-300 border-red-800/50', emoji: '🗡️' },
  gameplay: { accent: 'from-ember-600/80 to-orange-400/30', badge: 'bg-orange-950/50 text-orange-200 border-orange-800/50', emoji: '⚔️' },
  economy: { accent: 'from-amber-500/70 to-yellow-600/30', badge: 'bg-amber-950/50 text-amber-200 border-amber-800/50', emoji: '💰' },
  world: { accent: 'from-emerald-600/60 to-teal-500/30', badge: 'bg-emerald-950/50 text-emerald-200 border-emerald-800/50', emoji: '🌍' },
  ui: { accent: 'from-violet-600/60 to-purple-500/30', badge: 'bg-violet-950/50 text-violet-200 border-violet-800/50', emoji: '🎨' },
  polish: { accent: 'from-sky-600/50 to-indigo-500/30', badge: 'bg-sky-950/50 text-sky-200 border-sky-800/50', emoji: '✨' },
  bugfix: { accent: 'from-lime-600/50 to-green-500/30', badge: 'bg-lime-950/50 text-lime-200 border-lime-800/50', emoji: '🐛' },
  balance: { accent: 'from-cyan-600/50 to-blue-500/30', badge: 'bg-cyan-950/50 text-cyan-200 border-cyan-800/50', emoji: '⚖️' },
  feature: { accent: 'from-fuchsia-600/50 to-pink-500/30', badge: 'bg-fuchsia-950/50 text-fuchsia-200 border-fuchsia-800/50', emoji: '🔮' },
  default: { accent: 'from-ember-600/70 to-amber-500/30', badge: 'bg-void-900/80 text-[var(--gold)] border-ember-900/50', emoji: '🔥' },
};

function styleForCategory(category) {
  const key = String(category || '').trim().toLowerCase().replace(/&/g, '').replace(/\s+/g, ' ').replace(' management', '');
  if (key.includes('polish')) return CATEGORY_STYLES.polish;
  return CATEGORY_STYLES[key] || CATEGORY_STYLES.default;
}

export default function ChangelogEntryCard({ entry, featured = false }) {
  const style = styleForCategory(entry.category);
  const body = entry.body_md || entry.description;
  const dateLabel = formatTimestampShort(entry.created_at);

  return (
    <article
      className={clsx(
        'changelog-entry-card group relative overflow-hidden rounded-2xl border border-white/5 bg-[var(--bg3)] shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:border-ember-900/40',
        featured && 'ring-1 ring-ember-500/20',
      )}
    >
      <div className={clsx('absolute inset-y-0 left-0 w-1 bg-gradient-to-b', style.accent)} />
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-ember-500/5 blur-2xl transition group-hover:bg-ember-500/10" />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', style.badge)}>
              <span aria-hidden>{style.emoji}</span>
              {entry.category || 'Update'}
            </span>
            {entry.source === 'wishlist' ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text3)]">
                Wishlist
              </span>
            ) : null}
          </div>
          {dateLabel ? (
            <time className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text3)]">
              {dateLabel}
            </time>
          ) : null}
        </div>

        <h3 className="mb-3 font-cinzel text-xl font-bold leading-tight text-[var(--gold)] sm:text-[22px]">
          {entry.title}
        </h3>

        <div className="changelog-md prose-invert max-w-none border-t border-white/5 pt-4">
          {renderChangelogMarkdown(body)}
        </div>
      </div>
    </article>
  );
}