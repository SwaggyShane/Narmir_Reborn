import React, { useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api.js';
import { fmt } from '../../utils/fmt.js';
import { fmtShort } from '../../utils/numberFormat.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { useGameState } from '../../hooks/useGameState';
import { switchTab } from '../../utils/panelNav.js';
import { openDirectMessage } from '../../utils/directMessage.js';
import { targetFromRankings } from '../../utils/rankingsTarget.js';
import { toast } from '../../utils/toast.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';

let profileApi = null;

function setShellVisible(id, visible, display = 'flex') {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? display : 'none';
}

function normalizeRaceIcon(race) {
  return RACE_ICONS[race] || 'Kingdom';
}

function getPortrait(race, gender) {
  if (typeof window === 'undefined' || typeof window.getRacePortrait !== 'function') return '';
  try {
    return window.getRacePortrait(race, gender || 'male') || '';
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
    setShellVisible('kingdom-profile-modal', visible, 'flex');
    if (typeof document === 'undefined') return undefined;
    const app = document.getElementById('app');
    const nav = document.getElementById('bottom-nav');
    const prevApp = app ? app.style.pointerEvents : '';
    const prevNav = nav ? nav.style.pointerEvents : '';
    if (app) app.style.pointerEvents = visible ? 'none' : prevApp;
    if (nav) nav.style.pointerEvents = visible ? 'none' : prevNav;
    return () => {
      if (app) app.style.pointerEvents = prevApp;
      if (nav) nav.style.pointerEvents = prevNav;
    };
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

  const resFields = [
    { key: 'res_military', label: 'Military' },
    { key: 'res_economy', label: 'Economy' },
    { key: 'res_construction', label: 'Construction' },
    { key: 'res_spellbook', label: 'Spellbook' },
    { key: 'res_attack_magic', label: 'Attack Magic' },
    { key: 'res_entertainment', label: 'Entertainment' },
  ];

  const topRes = resFields
    .filter((field) => (data[field.key] || 0) > 0)
    .sort((a, b) => (data[b.key] || 0) - (data[a.key] || 0))
    .slice(0, 3);

  const statBox = (label, value, color) => (
    <div style={{ background: 'var(--bg3)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color }}>{value}</div>
    </div>
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '20px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeKingdomProfile();
      }}
    >
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={closeKingdomProfile}
          style={{
            position: 'absolute',
            top: '12px',
            right: '14px',
            background: 'none',
            border: 'none',
            color: 'var(--text3)',
            fontSize: '20px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          Close
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>Loading...</div>
        ) : error ? (
          <div style={{ color: 'var(--red)', textAlign: 'center', padding: '30px' }}>{error}</div>
        ) : profile ? (
          <>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'flex-start', textAlign: 'left' }}>
              <div style={{ flexShrink: 0, width: '120px' }}>
                <div style={{ width: '120px', height: '120px', background: 'var(--bg3)', border: '2px solid var(--gold)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', position: 'relative' }}>
                  {racePortrait ? (
                    <img
                      src={racePortrait}
                      alt="Portrait"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span style={{ fontSize: '40px', position: 'relative', zIndex: 0 }}>{raceIcon}</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--gold)', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Kingdom Sigil</div>
              </div>
              <div style={{ flex: 1, paddingTop: '4px' }}>
                <h2 style={{ color: 'var(--gold)', margin: '0 0 4px', fontSize: '24px' }}>{repairMojibake(data.name || name)}</h2>
                <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '4px', fontWeight: 500 }}>
                  {repairMojibake(data.username || '?')}{data.is_ai ? ' AI' : ''}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', background: 'var(--bg2)', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  {repairMojibake(data.region || 'Unknown Lands')}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>Kingdom Biography</div>
              <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {data.description ? repairMojibake(data.description).replace(/\n/g, '<br>') : 'No official chronicles found for this realm.'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {statBox('Global Rank', `#${data.rank || '???'}`, '#ffd700')}
              {statBox('Level', data.level || 1, 'var(--accent1)')}
              {statBox('Turns Used', fmt(data.turn || 0), 'var(--text2)')}
              {statBox('Total Score', fmt(data.score || 0), '#ffd700')}
              {statBox('Domain Size', `${fmtShort(data.land || 0)} ac`, 'var(--text2)')}
              {statBox('Population', fmtShort(data.population || 0), 'var(--text2)')}
              {statBox('Happiness', `${effHappiness}%`, effHappiness >= 100 ? 'var(--green)' : 'var(--amber)')}
              {statBox('Recent Combat', topNews.length ? 'ACTIVE' : 'NONE', topNews.length ? 'var(--red)' : 'var(--text3)')}
            </div>

            <div style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px', marginBottom: '20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>Military Intelligence</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', maxHeight: '100px', overflowY: 'auto', paddingRight: '4px' }}>
                {topNews.length
                  ? topNews.map((entry) => (
                      <div key={`${entry.turn_num || 'turn'}-${entry.message || ''}`} style={{ marginBottom: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', lineHeight: 1.4 }}>
                        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>T-{entry.turn_num}</span> {repairMojibake(entry.message || '')}
                      </div>
                    ))
                  : 'No recent field reports available for this kingdom.'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-accent"
                style={{ width: '100%', padding: '12px', fontWeight: 700 }}
                onClick={() => { openDirectMessage(data.player_id, data.name); closeKingdomProfile(); }}
              >
                Send Message to Ruler
              </button>
              {isMapped && !isMe ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button type="button" className="btn btn-gold" style={{ padding: '10px' }} onClick={() => { switchTab('bounties'); closeKingdomProfile(); }}>
                    Place Bounty
                  </button>
                  <button type="button" className="btn btn-gold" style={{ padding: '10px' }} onClick={async () => { await establishTradeRoute(); closeKingdomProfile(); }}>
                    Trade Route
                  </button>
                  <button type="button" className="btn btn-red" style={{ padding: '10px' }} onClick={() => { targetFromRankings(data.id, 'attack'); closeKingdomProfile(); }}>
                    Attack
                  </button>
                  <button type="button" className="btn btn-accent" style={{ padding: '10px' }} onClick={() => { targetFromRankings(data.id, 'spells'); closeKingdomProfile(); }}>
                    Cast Spell
                  </button>
                  <button type="button" className="btn" style={{ gridColumn: 'span 2', padding: '10px' }} onClick={() => { targetFromRankings(data.id, 'covert'); closeKingdomProfile(); }}>
                    Covert Operation
                  </button>
                </div>
              ) : isMe ? null : (
                <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center', padding: '16px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--bg2)', lineHeight: 1.5 }}>
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
