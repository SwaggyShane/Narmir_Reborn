import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api.mjs';

function AchievementRow({ ach }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--border)]">
      <div className="flex-1">
        <div className={`text-[13px] font-semibold ${ach.completed ? 'text-[var(--gold)]' : 'text-[var(--text)]'}`}>
          {ach.completed ? '🏆 ' : '🔒 '}{ach.title}
        </div>
        <div className="text-[11px] text-[var(--text3)]">{ach.description}</div>
        {!ach.completed && ach.progress && (
          <div className="text-2xs text-[var(--text3)] mt-0.5">
            Progress: {ach.progress.label} ({ach.progress.percent}%)
          </div>
        )}
      </div>
      {ach.completed && ach.reward && (
        <div className="text-[11px] text-[var(--green)] whitespace-nowrap">{ach.reward}</div>
      )}
    </div>
  );
}

function LoreSection({ title, entries }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-[12px] font-semibold text-[var(--gold)] mb-1">{title}</div>
      {entries.map((l) => (
        <div key={l.id} className="mb-2">
          <div className="text-[12px] font-semibold text-[var(--text)]">{l.title}</div>
          <div className="text-[11px] text-[var(--text3)]">{l.msg}</div>
        </div>
      ))}
    </div>
  );
}

export const LoreAndAchievements = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiCall('/api/kingdom/lore-and-achievements').then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const hasLore = Boolean(data && (data.raceLore?.length || data.narmirLore?.length || data.generalLore?.length));

  return (
    <>
      <div className="card m-0">
        <div className="card-title">Lore</div>
        <div id="library-lore-list" className="text-xs text-[var(--text2)] flex flex-col gap-2">
          {error && <div className="text-[var(--red)]">{error}</div>}
          {!error && !data && <div>Loading lore...</div>}
          {!error && data && !hasLore && (
            <div className="text-[var(--text3)]">No lore discovered yet.</div>
          )}
          {!error && data && hasLore && (
            <>
              <LoreSection title="Your Race" entries={data.raceLore} />
              <LoreSection title="Narmir" entries={data.narmirLore} />
              <LoreSection title="General" entries={data.generalLore} />
            </>
          )}
        </div>
      </div>
      <div className="card m-0">
        <div className="card-title">Achievements</div>
        <div id="library-achievements" className="mb-3 text-xs flex flex-col gap-2">
          {error && <div className="text-[var(--red)]">{error}</div>}
          {!error && !data && <div className="text-[var(--text3)]">Loading achievements...</div>}
          {!error && data && (!data.achievements || data.achievements.length === 0) && (
            <div className="text-[var(--text3)]">No achievements yet.</div>
          )}
          {!error && data?.achievements?.map((ach) => (
            <AchievementRow key={ach.id} ach={ach} />
          ))}
        </div>
      </div>
    </>
  );
};
