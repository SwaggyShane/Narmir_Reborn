import React, { useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from '../../utils/fmt.js';
import { fmtShort } from '../../utils/numberFormat.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { useGameState } from '../../hooks/useGameState';
import { switchTab } from '../../utils/panelNav.js';
import { openDirectMessage } from '../../utils/directMessage.js';
import { targetFromRankings } from '../../utils/rankingsTarget.js';
import { toast } from '../../utils/toast.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { getRacePortrait } from '../../utils/racePortraits.js';

let profileApi = null;

function syncModalVisibility(visible) {
  window.dispatchEvent(new CustomEvent('narmir:kingdom-profile-modal', { detail: { visible } }));
}

function normalizeRaceIcon(race) {
  return RACE_ICONS[race] || 'Kingdom';
}

function getPortrait(race, gender) {
  try {
    return getRacePortrait(race, gender || 'male') || '';
  } catch {
    return '';
  }
}

export function closeKingdomProfile() {
  profileApi?.close?.();
}

export async function openKingdomProfile(name) {
  return profileApi?.open?.(name) ?? null;
}

export default function KingdomProfileModal() {
  const { state } = useGameState();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    profileApi = {
      async open(nextName) {
        const target = String(nextName || '').trim();
        if (!target) return;
        setName(target);
        setError('');
        setProfile(null);
        setLoading(true);
        setVisible(true);
        try {
          const data = await apiCall('GET', '/api/kingdom/profile/' + encodeURIComponent(target));
          if (data && data.error) {
            setError(data.error);
            setProfile(null);
          } else {
            setProfile(data || null);
          }
        } catch (err) {
          setError(err?.message || 'Failed to load kingdom profile.');
          setProfile(null);
        } finally {
          setLoading(false);
        }
      },
      close() {
        setVisible(false);
        setLoading(false);
        setError('');
        setProfile(null);
        setName('');
      },
    };

    return () => {
      if (profileApi) profileApi = null;
    };
  }, []);

  useEffect(() => {
    syncModalVisibility(visible);
  }, [visible]);

  const data = profile || {};
  const isMe = !!(profile && state?.kingdomId && String(profile.id) === String(state.kingdomId));
  const disc = useMemo(() => {
    let discovered = state?.discovered_kingdoms || {};
    if (typeof discovered === 'string') {
      try {
        discovered = JSON.parse(discovered);
      } catch {
        discovered = {};
      }
    }
    return discovered || {};
  }, [state?.discovered_kingdoms]);
  const isMapped = !!(profile && disc[profile.id] && disc[profile.id].mapped);
  const effHappiness = data.happiness !== undefined && data.happiness !== null ? data.happiness : 50;
  const raceIcon = normalizeRaceIcon(data.race);
  const racePortrait = getPortrait(data.race, data.gender || 'male');
  const topNews = Array.isArray(data.news) ? data.news.slice(0, 5) : [];
  const establishTradeRoute = async () => {
    const result = await apiCall('/api/kingdom/trade-routes/establish', {
      method: 'POST',
      body: { targetId: data.id },
    });
    if (result.error) return toast(result.error, 'error');
    toast(result.message || 'Trade route established', 'success');
  };

  const statBox = (label, value, color) => (
    <div className="rounded-md bg-[var(--bg3)] p-2.5 text-center">
      <div className="mb-1 text-[10px] uppercase text-[var(--text3)]">{label}</div>
      <div className="text-base font-bold" style={{ color }}>{value}</div>
    </div>
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeKingdomProfile();
      }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg2)] p-7"
      >
        <button
          type="button"
          onClick={closeKingdomProfile}
          className="absolute right-3.5 top-3 border-0 bg-transparent text-xl leading-none text-[var(--text3)]"
        >
          Close
        </button>

        {loading ? (
          <div className="py-10 text-center text-[var(--text3)]">Loading...</div>
        ) : error ? (
          <div className="px-0 py-7 text-center text-[var(--red)]">{error}</div>
        ) : profile ? (
          <>
            <div className="mb-6 flex items-start gap-5 text-left">
              <div className="w-[120px] shrink-0">
                <div className="relative mb-2 flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-2xl border-2 border-[var(--gold)] bg-[var(--bg3)] shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  {racePortrait ? (
                    <img
                      src={racePortrait}
                      alt="Portrait"
                      className="absolute left-0 top-0 z-[1] h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.classList.add('hidden');
                      }}
                    />
                  ) : null}
                  <span className="relative z-0 text-[40px]">{raceIcon}</span>
                </div>
                <div className="text-center text-[10px] font-bold uppercase tracking-[1px] text-[var(--gold)]">Kingdom Sigil</div>
              </div>
              <div className="flex-1 pt-1">
                <h2 className="mb-1 text-2xl text-[var(--gold)]">{repairMojibake(data.name || name)}</h2>
                <div className="mb-1 text-sm font-medium text-[var(--text2)]">
                  {repairMojibake(data.username || '?')}{data.is_ai ? ' AI' : ''}
                </div>
                <div className="inline-block rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-0.5 text-xs text-[var(--text3)]">
                  {repairMojibake(data.region || 'Unknown Lands')}
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.5px] text-[var(--text3)]">Kingdom Biography</div>
              <div className="whitespace-pre-line text-sm italic leading-6 text-[var(--text)]">
                {data.description ? repairMojibake(data.description) : 'No official chronicles found for this realm.'}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {statBox('Global Rank', `#${data.rank || '???'}`, '#ffd700')}
              {statBox('Level', data.level || 1, 'var(--accent1)')}
              {statBox('Turns Used', fmt(data.turn || 0), 'var(--text2)')}
              {statBox('Total Score', fmt(data.score || 0), '#ffd700')}
              {statBox('Domain Size', `${fmtShort(data.land || 0)} ac`, 'var(--text2)')}
              {statBox('Population', fmtShort(data.population || 0), 'var(--text2)')}
              {statBox('Happiness', `${effHappiness}%`, effHappiness >= 100 ? 'var(--green)' : 'var(--amber)')}
              {statBox('Recent Combat', topNews.length ? 'ACTIVE' : 'NONE', topNews.length ? 'var(--red)' : 'var(--text3)')}
            </div>

            <div className="mb-5 rounded-[10px] border border-[var(--border)] bg-[var(--bg3)] p-3">
              <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[var(--text3)]">Military Intelligence</div>
              <div className="max-h-[100px] overflow-y-auto pr-1 text-xs text-[var(--text3)]">
                {topNews.length
                  ? topNews.map((entry) => (
                      <div key={`${entry.turn_num || 'turn'}-${entry.message || ''}`} className="mb-1.5 border-b border-[var(--border)] pb-1 leading-snug">
                        <span className="font-semibold text-[var(--text2)]">T-{entry.turn_num}</span> {repairMojibake(entry.message || '')}
                      </div>
                    ))
                  : 'No recent field reports available for this kingdom.'}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                className="btn btn-accent w-full p-3 font-bold"
                onClick={() => { openDirectMessage(data.player_id, data.name); closeKingdomProfile(); }}
              >
                Send Message to Ruler
              </button>
              {isMapped && !isMe ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button type="button" className="btn btn-gold p-2.5" onClick={() => { switchTab('bounties'); closeKingdomProfile(); }}>
                    Place Bounty
                  </button>
                  <button type="button" className="btn btn-gold p-2.5" onClick={async () => { await establishTradeRoute(); closeKingdomProfile(); }}>
                    Trade Route
                  </button>
                  <button type="button" className="btn btn-red p-2.5" onClick={() => { targetFromRankings(data.id, 'attack'); closeKingdomProfile(); }}>
                    Attack
                  </button>
                  <button type="button" className="btn btn-accent p-2.5" onClick={() => { targetFromRankings(data.id, 'spells'); closeKingdomProfile(); }}>
                    Cast Spell
                  </button>
                  <button type="button" className="btn p-2.5 sm:col-span-2" onClick={() => { targetFromRankings(data.id, 'covert'); closeKingdomProfile(); }}>
                    Covert Operation
                  </button>
                </div>
              ) : isMe ? null : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg2)] p-4 text-center text-[11px] leading-6 text-[var(--text3)]">
                  Exact coordinates unknown. Establish a map of this realm through exploration or intelligence to enable warfare operations.
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
