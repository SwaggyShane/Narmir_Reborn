import React, { useCallback, useEffect, useState } from 'react';
import LoreModal from './LoreModal.jsx';
import { registerOpenLoreEntry } from '../../utils/openLoreEntry.js';
import { repairMojibake } from '../../utils/repairMojibake.js';

export default function LoreEntryController() {
  const [entry, setEntry] = useState(null);

  const openEntry = useCallback((title, message, isHtml) => {
    setEntry({
      title: repairMojibake(title || ''),
      message: String(message ?? ''),
      isHtml: !!isHtml,
    });
  }, []);

  useEffect(() => registerOpenLoreEntry(openEntry), [openEntry]);

  return (
    <LoreModal
      isOpen={!!entry}
      onClose={() => setEntry(null)}
      title={entry?.title || ''}
    >
      {entry?.isHtml ? (
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg3)] p-3 text-[14px] leading-relaxed text-[var(--text2)]"
          dangerouslySetInnerHTML={{ __html: entry.message }}
        />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg3)] p-3 text-[14px] leading-relaxed text-[var(--text2)] whitespace-pre-wrap">
          {repairMojibake(entry?.message || '')}
        </div>
      )}
    </LoreModal>
  );
}