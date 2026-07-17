import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api.mjs';
import { toast } from '../../utils/toast.js';
import { useNavLayout } from '../../hooks/useNavLayout.js';
import { useColorTheme } from '../../hooks/useColorTheme.js';
import { COLOR_THEMES } from '../../utils/colorTheme.js';
import { showBugReportModal } from './BugReportModal.jsx';
import {
  useProfileStore,
  useDescription,
  useCustomPortrait,
  usePrestige,
  useLevel,
  useTurn,
  usePrestigeCooldownRemaining,
} from '../../stores';
import {
  PRESTIGE_LEVEL_GATE,
  PRESTIGE_COOLDOWN_TURNS,
  STARTER_BUILDINGS,
  landSeed,
  goldSeed,
  getPrestigeModifiers,
} from '../../utils/prestigeBalance.js';
import {
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
  DRAGON_FORM,
} from '../../utils/evolutionBalance.js';

const API = (path, opts = {}) => {
  const token = localStorage.getItem('narmir_token');
  return fetch(`/api/discord${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  }).then((r) => r.json());
};

const cardShell = 'rounded-2xl border border-[var(--border)] bg-[var(--bg3)] p-4';
const sectionTitle = 'card-title !mb-0';
const labelClass = 'mb-1 block text-[12px] text-[var(--text3)]';
const inputShell =
  'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-[var(--accent1)]';

const DiscordSection = () => {
  const [linkStatus, setLinkStatus] = useState(null);
  const [manualUserId, setManualUserId] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API('/link-status').then((data) => setLinkStatus(data)).catch(() => {});
  }, []);

  const flash = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleManualLink = async () => {
    if (!manualUserId.trim() || !manualUsername.trim()) return flash('Both fields are required.', 'err');
    setLoading(true);
    try {
      const data = await API('/link-discord', {
        method: 'POST',
        body: JSON.stringify({ discordUserId: manualUserId.trim(), discordUsername: manualUsername.trim() }),
      });
      if (data.ok) {
        flash(`Linked to @${manualUsername.trim()}!`);
        setLinkStatus({ linked: true, discordUsername: manualUsername.trim() });
        setManualUserId('');
        setManualUsername('');
      } else {
        flash(data.error || 'Failed to link.', 'err');
      }
    } catch (e) {
      flash('Network error.', 'err');
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!verifyCode.trim()) return flash('Enter your verification code.', 'err');
    setLoading(true);
    try {
      const data = await API('/verify-token', {
        method: 'POST',
        body: JSON.stringify({ token: verifyCode.trim().toUpperCase() }),
      });
      if (data.ok) {
        flash(`Linked to @${data.discordUsername}!`);
        setLinkStatus({ linked: true, discordUsername: data.discordUsername });
        setVerifyCode('');
      } else {
        flash(data.error || 'Invalid or expired code.', 'err');
      }
    } catch (e) {
      flash('Network error.', 'err');
    }
    setLoading(false);
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      const data = await API('/unlink-discord', { method: 'POST' });
      if (data.ok) {
        flash('Discord account unlinked.');
        setLinkStatus({ linked: false });
      } else {
        flash(data.error || 'Failed to unlink.', 'err');
      }
    } catch (e) {
      flash('Network error.', 'err');
    }
    setLoading(false);
  };

  return (
    <section className={cardShell}>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[20px]">💬</span>
        <div className={sectionTitle}>Discord Integration</div>
      </div>

      <div
        className={clsx(
          'mb-4 flex items-center justify-between gap-3 rounded-[var(--radius)] border px-4 py-3',
          linkStatus?.linked
            ? 'border-[#58a6ff] bg-[rgba(88,166,255,0.12)]'
            : 'border-[var(--border)] bg-[var(--bg3)]'
        )}
      >
        <span className={clsx(
          'text-[13px]',
          linkStatus?.linked ? 'text-[#58a6ff]' : 'text-[var(--text3)]'
        )}>
          {linkStatus == null
            ? '⏳ Checking link status...'
            : linkStatus.linked
              ? `✅ Connected to Discord as @${linkStatus.discordUsername}`
              : '⚪ Discord account not linked'}
        </span>
        {linkStatus?.linked && (
          <button
            className="base-btn variant-red bg-[var(--red)] px-3 py-1 text-[12px]"
            onClick={handleUnlink}
            disabled={loading}
          >
            Unlink
          </button>
        )}
      </div>

      {msg && (
        <div
          className={clsx(
            'mb-4 rounded-[var(--radius)] border px-3 py-2 text-[13px]',
            msg.type === 'ok'
              ? 'border-[var(--green)] bg-[rgba(63,185,80,0.15)] text-[var(--green)]'
              : 'border-[var(--red)] bg-[rgba(248,81,73,0.15)] text-[var(--red)]'
          )}
        >
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={cardShell}>
          <div className="mb-3 text-[13px] font-bold">
            🔮 Method 1 - Verification Code <span className="text-[11px] font-normal text-[var(--accent1)]">RECOMMENDED</span>
          </div>
          <div className="mb-3 text-[12px] leading-6 text-[var(--text2)]">
            <strong className="text-[var(--text)]">Step 1.</strong> In the Narmir Reborn Discord server, type:
            <br />
            <code className="mt-1 inline-block rounded bg-[var(--bg2)] px-2 py-1 text-[var(--accent1)]">
              !link {(JSON.parse(localStorage.getItem('player') || '{}').username) || 'YourUsername'}
            </code>
            <br />
            <br />
            <strong className="text-[var(--text)]">Step 2.</strong> The bot will DM you a 6-character code. Enter it below.
          </div>
          <label className={labelClass}>Verification Code</label>
          <input
            className={`${inputShell} mb-3 tracking-[3px] font-bold uppercase`}
            placeholder="ABC123"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
          />
          <button
            className="base-btn variant-accent w-full bg-[var(--accent1)]"
            onClick={handleVerifyCode}
            disabled={loading || !verifyCode.trim()}
          >
            Verify Code
          </button>
        </div>

        <div className={cardShell}>
          <div className="mb-3 text-[13px] font-bold">🔧 Method 2 - Manual Entry</div>
          <div className="mb-3 text-[12px] leading-6 text-[var(--text2)]">
            In Discord: <strong className="text-[var(--text)]">Settings → Advanced → Enable Developer Mode</strong>, then right-click your username and select <strong className="text-[var(--text)]">Copy User ID</strong>.
          </div>
          <label className={labelClass}>Discord User ID</label>
          <input
            className={`${inputShell} mb-2`}
            placeholder="e.g. 123456789012345678"
            value={manualUserId}
            onChange={(e) => setManualUserId(e.target.value)}
          />
          <label className={labelClass}>Discord Username</label>
          <input
            className={`${inputShell} mb-3`}
            placeholder="e.g. swaggyshane"
            value={manualUsername}
            onChange={(e) => setManualUsername(e.target.value)}
          />
          <button
            className="base-btn w-full border border-[var(--border)] bg-[var(--bg2)]"
            onClick={handleManualLink}
            disabled={loading || !manualUserId.trim() || !manualUsername.trim()}
          >
            Link Account
          </button>
        </div>
      </div>
    </section>
  );
};

const PortraitUploadCard = () => {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const customPortrait = useCustomPortrait();
  const hasCustom = !!customPortrait;

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    setMsg('');
    const form = new FormData();
    form.append('portrait', file);
    try {
      const res = await fetch('/api/kingdom/portrait', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        useProfileStore.getState().updateCustomPortrait(data.portraitUrl);
        setMsg('Portrait updated.');
      } else {
        URL.revokeObjectURL(objectUrl);
        setPreview(null);
        setMsg(data.error || 'Upload failed.');
      }
    } catch {
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      setMsg('Upload failed.');
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    setUploading(true);
    setMsg('');
    try {
      const res = await fetch('/api/kingdom/portrait', { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        useProfileStore.getState().updateCustomPortrait(null);
        setPreview(null);
        setMsg('Portrait removed.');
      } else {
        setMsg(data.error || 'Failed to remove.');
      }
    } catch {
      setMsg('Failed to remove.');
    }
    setUploading(false);
  };

  return (
    <section className={cardShell}>
      <div className="card-title">Custom portrait</div>
      <div className="mb-3 flex items-start gap-3">
        {(preview || hasCustom) && (
          <img
            src={preview || customPortrait}
            alt="Custom portrait"
            className="h-16 w-16 rounded-md border border-[var(--border)] object-cover"
          />
        )}
        <div className="text-[13px] leading-6 text-[var(--text2)]">
          Upload a custom portrait that appears next to your kingdom name. Max 5MB - JPG, PNG, GIF or WebP.
          <br />
          <span className="text-[12px] text-[var(--text3)]">Recommended: 360x480px | 3:4 ratio (portrait orientation)</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="base-btn variant-accent cursor-pointer bg-[var(--accent1)] px-4 py-2 text-[12px]">
          {uploading ? 'Uploading…' : 'Upload portrait'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {hasCustom && (
          <button className="base-btn variant-red px-4 py-2 text-[12px]" onClick={handleRemove} disabled={uploading}>
            Remove
          </button>
        )}
      </div>
      {msg && <div className="mt-2 text-[12px] text-[var(--text2)]">{msg}</div>}
    </section>
  );
};

const DragonEvolutionSection = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/kingdom/evolution');
      if (data?.error) {
        setStatus(null);
        return;
      }
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startRitual = async () => {
    const ok = window.confirm(
      `Begin ENDGAME dragon evolution?\n\n` +
        `This is an optional endgame identity — tradeoffs, not free power.\n` +
        `Requires Prestige ${EVOLUTION_PRESTIGE_GATE}+, a rare Dragon Egg (epic trek), and at least 1 castle.\n` +
        `Channel for ${RITUAL_TURNS} turns (defense ×0.85 while channeling). Castles to 0 → ritual fails, egg lost.\n` +
        `On success: defense ×${DRAGON_FORM.defenseMult}, upkeep ×${DRAGON_FORM.upkeepMult}, ` +
        `terror vs lower prestige ×${DRAGON_FORM.terrorVsLowerPrestige}, hoard econ ×${DRAGON_FORM.hoardEconMult}.\n` +
        `No free global combat bonus (prestige combat still max ×1.05).\n` +
        `Dragon form is kept across future prestige rebirths.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiCall('/api/kingdom/evolution/start', { method: 'POST', body: {} });
      if (result.error) return toast(result.error, 'error');
      toast(`Dragon ritual started — ${RITUAL_TURNS} turns of channeling.`, 'success');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const abortRitual = async () => {
    const ok = window.confirm(
      'Abort dragon ritual? The egg was already consumed and will not return.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiCall('/api/kingdom/evolution/abort', { method: 'POST', body: {} });
      if (result.error) return toast(result.error, 'error');
      toast('Ritual aborted. Egg remains spent.', 'warn');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const ritual = status?.ritual;
  const remaining = ritual?.state === 'CHANNELING' ? ritual.turns_remaining : null;

  return (
    <section
      className="rounded-2xl border-2 border-[var(--gold)] bg-[var(--bg2)] p-5"
      data-testid="dragon-evolution-panel"
    >
      <div className="card-title !mb-3 text-[var(--gold)]">Dragon Evolution (Endgame)</div>
      <div className="mb-4 text-[14px] leading-7 text-[var(--text2)]">
        <strong className="text-[var(--gold)]">Optional endgame identity</strong> — not a midgame power spike.
        Tradeoffs only; prestige combat still hard-caps at ×1.05. Form is permanent once complete (survives rebirth).
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Prestige {EVOLUTION_PRESTIGE_GATE}+ (late ladder), rare Dragon Egg (epic trek), hold a castle</li>
          <li>{RITUAL_TURNS}-turn vulnerable channel (defense ×0.85); egg spent on start</li>
          <li>
            Form: defense ×{DRAGON_FORM.defenseMult}, upkeep ×{DRAGON_FORM.upkeepMult}, terror vs weaker realms,
            small hoard — not free combat
          </li>
        </ul>
      </div>
      {loading && (
        <div className="mb-3 text-[12px] text-[var(--text3)]" data-testid="dragon-evo-loading">
          Loading evolution status…
        </div>
      )}
      {!loading && status && (
        <div className="mb-3 space-y-1 text-[13px] text-[var(--text2)]" data-testid="dragon-evo-status">
          <div>
            Form:{' '}
            <strong data-testid="dragon-evo-form">{status.isDragon ? 'Dragon' : status.form || 'None'}</strong>
          </div>
          <div>
            Egg:{' '}
            <strong data-testid="dragon-evo-egg">{status.hasEgg ? 'Yes' : 'No'}</strong>
          </div>
          <div>
            Ritual:{' '}
            <strong data-testid="dragon-evo-ritual">
              {status.isChanneling
                ? `Channeling (${remaining ?? '?'} turns left)`
                : ritual?.state || 'Idle'}
            </strong>
          </div>
          {!status.canStart && !status.isDragon && !status.isChanneling && status.canStartError && (
            <div className="text-[12px] text-[var(--red)]" data-testid="dragon-evo-block">
              {status.canStartError}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="base-btn variant-accent bg-[var(--gold)] px-5 py-2 font-bold text-black disabled:opacity-50"
          data-testid="dragon-evo-start-btn"
          onClick={startRitual}
          disabled={busy || loading || !status?.canStart}
        >
          BEGIN RITUAL
        </button>
        <button
          type="button"
          className="base-btn variant-red px-5 py-2 font-bold disabled:opacity-50"
          data-testid="dragon-evo-abort-btn"
          onClick={abortRitual}
          disabled={busy || loading || !status?.isChanneling}
        >
          ABORT RITUAL
        </button>
        <button
          type="button"
          className="base-btn px-4 py-2 text-[12px]"
          data-testid="dragon-evo-refresh-btn"
          onClick={refresh}
          disabled={busy || loading}
        >
          Refresh
        </button>
      </div>
    </section>
  );
};

const OptionsPanel = () => {
  const storedDescription = useDescription();
  const prestige = usePrestige();
  const level = useLevel();
  const turn = useTurn();
  const cooldownRemaining = usePrestigeCooldownRemaining();
  const { layout: navLayout, setLayout: setNavLayout } = useNavLayout();
  const levelOk = (level || 0) >= PRESTIGE_LEVEL_GATE;
  const cooldownOk = (cooldownRemaining || 0) <= 0;
  const canRebirth = levelOk && cooldownOk;
  const nextPrestige = (prestige || 0) + 1;
  const previewLand = landSeed(nextPrestige);
  const previewGold = goldSeed(nextPrestige);
  const previewMods = getPrestigeModifiers(nextPrestige);
  const { theme: colorTheme, setTheme: setColorTheme } = useColorTheme();
  const [skipIntro, setSkipIntro] = useState(() => {
    try { return localStorage.getItem('narmir_skip_intro') === '1'; } catch { return false; }
  });
  const [skipGlitch, setSkipGlitch] = useState(() => {
    try { return localStorage.getItem('narmir_skip_glitch') === '1'; } catch { return false; }
  });
  const [description, setDescription] = useState(storedDescription || '');

  useEffect(() => {
    setDescription(storedDescription || '');
  }, [storedDescription]);

  const updateNavLayout = (e) => {
    setNavLayout(e.target.value);
  };

  const updateColorTheme = (e) => {
    setColorTheme(e.target.value);
  };

  const updateSkipIntro = (e) => {
    const val = e.target.checked;
    setSkipIntro(val);
    try {
      if (val) {
        localStorage.setItem('narmir_skip_intro', '1');
      } else {
        localStorage.removeItem('narmir_skip_intro');
        sessionStorage.removeItem('narmir_intro_seen');
      }
    } catch (err) {
      console.warn('Storage access blocked:', err);
    }
  };

  const updateSkipGlitch = (e) => {
    const val = e.target.checked;
    setSkipGlitch(val);
    try {
      if (val) {
        localStorage.setItem('narmir_skip_glitch', '1');
      } else {
        localStorage.removeItem('narmir_skip_glitch');
      }
    } catch (err) {
      console.warn('Storage access blocked:', err);
    }
  };

  const requestVacation = () => {
    toast('Vacation mode is currently disabled by admin', 'warn');
  };

  const initiateRebirth = async () => {
    const nextP = (prestige || 0) + 1;
    const nextLand = landSeed(nextP);
    const nextGold = goldSeed(nextP);
    const ok = window.confirm(
      `Rebirth to Prestige ${nextP}?\n\n` +
        `You will receive: land ${nextLand.toLocaleString()}, gold ${nextGold.toLocaleString()}, starter buildings only.\n` +
        `You lose: army, castles/markets/walls (and most buildings), fragments/attunements, items (incl. uneaten dragon eggs), research progress, trade routes, active expeditions (no payout).\n` +
        `You keep: race, maps, discovery, achievements, lore, top 3 heroes, and endgame dragon form if already evolved.\n` +
        `If a dragon ritual is still channeling, it is aborted (egg already spent).\n` +
        `Then ${PRESTIGE_COOLDOWN_TURNS} turns (~3.5 days) before you can rebirth again.`,
    );
    if (!ok) return;
    const result = await apiCall('/api/kingdom/rebirth', { method: 'POST', body: {} });
    if (result.error) return toast(result.error, 'error');
    const seeds = result.seeds || {};
    useProfileStore.getState().applyPrestigeSnapshot({
      prestige_level: result.prestige_level,
      last_prestige_turn: result.updates?.profile?.last_prestige_turn
        ?? result.updates?.last_prestige_turn
        ?? turn,
      level: 1,
      turn,
    });
    if (result.prestige_level !== undefined) {
      useProfileStore.getState().updatePrestigeLevel(result.prestige_level);
    }
    const m = result.modifiers || {};
    const bonusBits = [
      m.bldCap && m.bldCap !== 1 ? `building caps ×${m.bldCap}` : null,
      m.econ && m.econ !== 1 ? `economy ×${m.econ}` : null,
      m.combat && m.combat !== 1 ? `combat ×${m.combat}` : null,
      m.pop && m.pop !== 1 ? `pop ×${m.pop}` : null,
    ].filter(Boolean);
    const landMsg = seeds.land != null ? ` Land ${Number(seeds.land).toLocaleString()}.` : '';
    const goldMsg = seeds.gold != null ? ` Gold ${Number(seeds.gold).toLocaleString()}.` : '';
    toast(
      `Transcended${result.title ? ` (${result.title})` : ''}.${landMsg}${goldMsg} Permanent: ${bonusBits.join(', ') || 'see prestige tier'}. Reloading...`,
      'success',
    );
    window.location.reload();
  };

  const saveDescription = async () => {
    const result = await apiCall('/api/kingdom/description', {
      method: 'POST',
      body: { description },
    });
    if (result.error) return toast(result.error, 'error');
    useProfileStore.getState().updateDescription(description);
    toast('Kingdom bio saved', 'success');
  };

  return (
    <div id="options" className="panel">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <section className={cardShell}>
            <div className="card-title">Kingdom bio</div>
            <textarea
              maxLength="1000"
              placeholder="Tell the world about your kingdom..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg3)] p-3 text-[13px] text-[var(--text2)] outline-none transition focus:border-[var(--accent1)]"
            />
            <div className="mt-3 flex justify-end">
              <button className="base-btn variant-accent bg-[var(--accent1)] px-4 py-2 text-[12px]" onClick={saveDescription}>
                Save Bio
              </button>
            </div>
          </section>

          <PortraitUploadCard />

          <section className={cardShell}>
            <div className="card-title">Vacation mode</div>
            <div className="mb-4 text-[13px] leading-7 text-[var(--text2)]">
              While on vacation your kingdom cannot be attacked or targeted by spells, but you cannot take turns or interact with others. Intended for planned real-world absences. This feature is currently restricted by the game admin.
            </div>
            <button className="base-btn variant-red bg-[var(--red)] px-4 py-2 text-[12px]" onClick={requestVacation}>
              Request vacation mode
            </button>
          </section>

          <section className={cardShell}>
            <div className={sectionTitle}>Help & Feedback</div>
            <p className="mb-3 text-[13px] leading-6 text-[var(--text2)]">
              Found a bug or something broken? Send a report straight to the admin team (and Discord when configured).
            </p>
            <button type="button" className="base-btn variant-green bg-[var(--green)] px-4 py-2 text-[13px]" onClick={showBugReportModal}>
              Report a Bug
            </button>
          </section>

          <section className={cardShell}>
            <div className="card-title">Interface Settings</div>
            <div className="mb-4 text-[13px] leading-6 text-[var(--text2)]">
              Customize your application layout and preferred navigation style. Choose between responsive defaults or force a specific nav bar.
            </div>
            <div className="mb-3">
              <label className={labelClass}>Color Theme</label>
              <select value={colorTheme} onChange={updateColorTheme} className={inputShell}>
                {COLOR_THEMES.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    title={theme.label}
                    aria-label={theme.label}
                    aria-pressed={colorTheme === theme.id}
                    onClick={() => setColorTheme(theme.id)}
                    className={clsx(
                      'h-8 w-8 rounded-full border-2 transition hover:scale-105',
                      colorTheme === theme.id ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.35)]' : 'border-white/20',
                    )}
                    style={{ background: theme.preview }}
                  />
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className={labelClass}>Navigation Layout Style</label>
              <select value={navLayout} onChange={updateNavLayout} className={inputShell}>
                <option value="responsive">Default (Responsive Sidebar / Bottom Nav)</option>
                <option value="left">Left Navigation Bar Only (Sidebar)</option>
                <option value="bottom">Bottom Navigation Bar Only</option>
              </select>
            </div>
            <label className="mb-3 flex items-center gap-3">
              <input type="checkbox" checked={skipIntro} onChange={updateSkipIntro} className="h-4 w-4 accent-[var(--accent1)]" />
              <span className="text-[13px] leading-6 text-[var(--text2)]">Skip intro animation when visiting the home page</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={skipGlitch} onChange={updateSkipGlitch} className="h-4 w-4 accent-[var(--accent1)]" />
              <span className="text-[13px] leading-6 text-[var(--text2)]">Skip glitch effect (jump to modern splash on click)</span>
            </label>
          </section>
        </div>

        <section className="rounded-2xl border-2 border-[var(--accent1)] bg-[var(--bg2)] p-5" data-testid="prestige-rebirth-panel">
          <div className="card-title !mb-3 text-[var(--accent1)]">Empire Rebirth (Kingdom Prestige)</div>
          <div className="mb-4 text-[14px] leading-7 text-[var(--text2)]">
            At <strong className="text-[var(--gold)]">Level {PRESTIGE_LEVEL_GATE}</strong> (max) you may rebirth. Current prestige:{' '}
            <strong className="text-[var(--accent1)]" data-testid="prestige-current">{prestige || 0}</strong>
            {' '}(kingdom level <span data-testid="prestige-kingdom-level">{level || 0}</span>).
            <br />
            <br />
            <strong className="text-[var(--gold)]">If you rebirth now (to Prestige {nextPrestige}):</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                New land:{' '}
                <strong data-testid="prestige-preview-land">{previewLand.toLocaleString()}</strong>
              </li>
              <li>
                New gold:{' '}
                <strong data-testid="prestige-preview-gold">{previewGold.toLocaleString()}</strong>
              </li>
              <li>
                Starter buildings only ({STARTER_BUILDINGS.bld_farms} farms, {STARTER_BUILDINGS.bld_barracks} barracks,{' '}
                {STARTER_BUILDINGS.bld_schools} school, {STARTER_BUILDINGS.bld_housing} housing)
              </li>
              <li>Army, castles, markets, walls, fragments, research progress wiped; kingdom returns to level 1</li>
              <li>Keep: race, maps, discovery, achievements, lore, top 3 heroes</li>
              <li>Then {PRESTIGE_COOLDOWN_TURNS} turns (~3.5 days) cooldown before next rebirth</li>
            </ul>
            <br />
            <strong className="text-[var(--gold)]">Permanent mults after this rebirth (hard-cap Prestige 5):</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5" data-testid="prestige-preview-mults">
              <li>Building caps ×{previewMods.bldCap}, economy ×{previewMods.econ}, combat ×{previewMods.combat}, pop ×{previewMods.pop}</li>
              <li>XP to level costs +20% per prestige rank</li>
            </ul>
          </div>
          {!levelOk && (
            <div className="mb-3 text-[12px] text-[var(--red)]" data-testid="prestige-block-level">
              Require Kingdom Level {PRESTIGE_LEVEL_GATE} to Rebirth (you are level {level || 0}).
            </div>
          )}
          {levelOk && !cooldownOk && (
            <div className="mb-3 text-[12px] text-[var(--red)]" data-testid="prestige-block-cooldown">
              Prestige cooldown: {cooldownRemaining} turn{cooldownRemaining === 1 ? '' : 's'} remaining
              (~{Math.max(1, Math.ceil((cooldownRemaining * 25) / 60))} hours wall clock at 25 min/turn).
            </div>
          )}
          <button
            type="button"
            className="base-btn variant-accent bg-[var(--accent1)] px-6 py-3 font-bold disabled:opacity-50"
            id="rebirth-btn"
            data-testid="prestige-ascend-btn"
            onClick={initiateRebirth}
            disabled={!canRebirth}
          >
            ASCEND EMPIRE
          </button>
        </section>

        <DragonEvolutionSection />

        <DiscordSection />
      </div>
    </div>
  );
};

export default OptionsPanel;
