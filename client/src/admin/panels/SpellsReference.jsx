import React, { useState, useEffect, useCallback } from 'react';

const TIER_INFO = {
  1: { label: '①', title: 'Foundational', icon: '📖' },
  2: { label: '②', title: 'Intermediate', icon: '⚔️' },
  3: { label: '③', title: 'Advanced', icon: '🔥' },
  4: { label: '④', title: 'Ultimate', icon: '💀' },
  5: { label: '⑤', title: 'Ascendant', icon: '✨' },
};

const SCHOOL_INFO = {
  abjuration:   { name: 'Abjuration',   icon: '🛡️', desc: 'Protection & Defense' },
  conjuration:  { name: 'Conjuration',  icon: '✨', desc: 'Creation & Summoning' },
  divination:   { name: 'Divination',   icon: '🔮', desc: 'Foresight & Information' },
  enchantment:  { name: 'Enchantment',  icon: '💫', desc: 'Charm & Influence' },
  evocation:    { name: 'Evocation',    icon: '⚡', desc: 'Damage & Force' },
  illusion:     { name: 'Illusion',     icon: '👁️', desc: 'Deception & Trickery' },
  necromancy:   { name: 'Necromancy',   icon: '💀', desc: 'Death & Undeath' },
  transmutation:{ name: 'Transmutation',icon: '🔄', desc: 'Change & Transformation' },
};

const SCHOOL_ORDER = Object.keys(SCHOOL_INFO);

function spellLabel(id) {
  return String(id).replace(/_/g, ' ');
}

function CollapsibleSection({ title, meta, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border2)', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', background: 'var(--bg3)', border: 'none',
          color: 'var(--text2)', fontSize: 13, cursor: 'pointer', textAlign: 'left',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <span style={{ flex: 1, fontWeight: 600 }}>{title}</span>
        {meta ? <span style={{ fontSize: 11, color: 'var(--text3)' }}>{meta}</span> : null}
        <span style={{ color: 'var(--text3)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open ? <div style={{ padding: '10px 12px 12px' }}>{children}</div> : null}
    </div>
  );
}

function SpellCard({ spellId, spell, schoolDiscount }) {
  const minSb = schoolDiscount ? Math.ceil(spell.minSB * 0.85) : spell.minSB;
  const sbLabel = schoolDiscount ? 'School Spellbook' : 'Spellbook Required';
  const sbNote = schoolDiscount ? ' (15% reduction)' : '';
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border)',
      borderRadius: 6, padding: 10, fontSize: 11,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>{spellLabel(spellId)}</div>
      <div style={{ color: 'var(--text2)', marginBottom: 6, lineHeight: 1.35 }}>{spell.desc}</div>
      <div style={{ color: 'var(--text3)', fontSize: 10 }}>
        <strong>{sbLabel}:</strong> {minSb}{sbNote}
      </div>
    </div>
  );
}

export default function SpellsReference({ onToast }) {
  const [spellDefs, setSpellDefs] = useState({});
  const [magicSchools, setMagicSchools] = useState({});
  const [loading, setLoading] = useState(true);

  const loadSpells = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/spell-definitions', { credentials: 'include' });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setSpellDefs(data.SPELL_DEFS || {});
      setMagicSchools(data.MAGIC_SCHOOLS || {});
    } catch (err) {
      onToast?.('Failed to load spells: ' + (err.message || 'Unknown'), 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { loadSpells(); }, [loadSpells]);

  const spellsByTier = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  Object.entries(spellDefs).forEach(([id, spell]) => {
    const tier = spell?.tier;
    if (tier >= 1 && tier <= 5) spellsByTier[tier].push(id);
  });
  [1, 2, 3, 4, 5].forEach(tier => {
    spellsByTier[tier].sort((a, b) => (spellDefs[a]?.minSB || 0) - (spellDefs[b]?.minSB || 0));
  });

  if (loading) {
    return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading spell reference...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>
          Read-only reference — original spellbook and school spells from game config.
        </span>
        <button onClick={loadSpells} style={BTN}>Refresh</button>
      </div>

      <h3 style={{ color: 'var(--gold)', fontSize: 14, margin: '0 0 12px' }}>📚 Original Spellbook</h3>
      {[1, 2, 3, 4].map(tier => {
        const spells = spellsByTier[tier];
        if (!spells.length) return null;
        const t = TIER_INFO[tier];
        return (
          <CollapsibleSection
            key={`orig-${tier}`}
            title={<><span>{t.icon}</span> Tier {t.label} — {t.title}</>}
            meta={`${spells.length} spells`}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {spells.map(id => (
                <SpellCard key={id} spellId={id} spell={spellDefs[id]} />
              ))}
            </div>
          </CollapsibleSection>
        );
      })}

      <h3 style={{ color: 'var(--gold)', fontSize: 14, margin: '24px 0 12px' }}>🔮 Schools of Magic</h3>
      {SCHOOL_ORDER.map(schoolKey => {
        const schoolSpells = magicSchools[schoolKey];
        if (!Array.isArray(schoolSpells) || schoolSpells.length === 0) return null;
        const meta = SCHOOL_INFO[schoolKey];
        const byTier = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        schoolSpells.forEach(id => {
          const spell = spellDefs[id];
          if (spell?.tier) byTier[spell.tier].push(id);
        });
        Object.keys(byTier).forEach(tier => {
          byTier[tier].sort((a, b) => (spellDefs[a]?.minSB || 0) - (spellDefs[b]?.minSB || 0));
        });

        return (
          <CollapsibleSection
            key={schoolKey}
            title={<><span>{meta.icon}</span> {meta.name} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>— {meta.desc}</span></>}
            meta={`${schoolSpells.length} spells`}
          >
            {[1, 2, 3, 4, 5].map(tier => {
              const spells = byTier[tier];
              if (!spells.length) return null;
              const t = TIER_INFO[tier];
              return (
                <div key={tier} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                    {t.icon} Tier {t.label} — {t.title}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {spells.map(id => (
                      <SpellCard key={id} spellId={id} spell={spellDefs[id]} schoolDiscount />
                    ))}
                  </div>
                </div>
              );
            })}
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

const BTN = {
  padding: '6px 12px', marginLeft: 'auto', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
};