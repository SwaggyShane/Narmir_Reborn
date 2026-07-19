# Admin Wishlist Plan

Backlog for optional/low-priority feature ideas. **Not** the active product TODO (`TODO.md`).

**Verification rule:** Nothing is done until traced on a live code path. Docs alone do not count.

**Last audited:** 2026-07-18 — Prestige economy reclassified complete (both roadmaps verified live-DB/live-HTTP; `EVOLUTION.md` archived and deleted).

---

## Done / Archived

Evidence also in [ARCHIVAL.md](ARCHIVAL.md) (*Admin wishlist validity audit*).

| Item | Disposition | Evidence |
|------|-------------|----------|
| **Spell casting target history** | Complete | `client/src/utils/spellTargetHistory.js`; UI in `SpellCastingModal.jsx` + `WarfarePanel.jsx`; cast write in `useGameActions.js`; `spellTargetHistory.test.js` |
| **Terrain advantages** | Complete | `game/combat-resolver.js` applies `combatAtk`/`combatDef` from `game/terrain.js`; expeditions use `expSpeed`/`resourceYield` |
| **Resource biomes** | Complete | World hex biomes (`game/world-hex-grid.js` / `world-initialization.js` mixed biomes); terrain on resource nodes (`passive-resource-node-spawn.js`); hunting/prospecting/land economy terrain modifiers; expedition `resourceYield` by terrain |
| **Dark / light / high-contrast theme toggles** | **Nixed** | Product decision 2026-07-16: app already ships dark UI + accent color themes (`client/src/utils/colorTheme.js`). Not a backlog item. |
| **Prestige economy** | Complete | `game/prestige/` (full wipe/caps/TX contract) + `game/evolution/` (dragon endgame form) — both roadmaps verified live-DB and live-HTTP 2026-07-18. Evidence also in [ARCHIVAL.md](ARCHIVAL.md) (*Prestige & Dragon Evolution complete*). |

---

## Partial (adjacent systems exist; wishlist intent not fully shipped)

- **Mercenary guilds** — basic merc hire/upkeep/contracts exist (`game/lib/gameplay.js`'s `processMercenaries`/`hireMercenaries` — `game/mercenaries.js` was an orphaned pre-refactor duplicate, deleted 2026-07-19); not distinct hireable **factions**.
- **Artifact hunting** — epic-trek artifacts + dungeon/mountain expeditions exist; not a dedicated high-risk hunt loop.
- **Dungeons and raids** — regional dungeon/mountain PvE expeditions exist; not multi-kingdom cooperative raids.
- **Caravans / trade risk** — trade routes + Orc `raid_trade_route` exist; not general physical caravan entities.
- **Espionage network** — covert ops / spy surfaces exist; not permanent passive intel on nearby kingdoms.
- **Dynamic world events** — seasonal/race event seeds + random flavor exist; not global comet/earthquake-style modifiers.
- **Full iOS / Android PWA wrapping** — web app only; no manifest/service worker/store wrap.
- **Step-by-step interactive new player tutorial** — `NEW_PLAYER_TUTORIAL.md` docs only; no in-client flow.

---

## Still Missing

### Gameplay

- **Diplomacy** — formal non-aggression pacts, tribute, treaty state with server validation.
- **Resource loans** — player-to-player lending with repayment and delinquency.
- **Religion / pantheon** — deity selection, domain bonuses, long-term allegiance.
- **Laws & edicts** — kingdom policies with tradeoffs and cooldown/upkeep.
- **Prisoners of war** — ransom / release / execution flows tied to combat outcomes.

### Combat

- **Alliance war** — alliance-level war declarations and shared hostility state.
- **Naval combat** — ships and ocean-zone engagement rules.
- **Generals** — commander units with morale/tactical battle bonuses.
- **Naval trade routes** — sea lanes that are profitable but vulnerable.

### Economy

- **Auction house** — marketboard for unique gear / captured heroes.
- **Smuggling rings** — hidden trade that bypasses taxes at higher risk.
- **Global market history** — price history charts for commodities.

### World

- **More races** — e.g. Gnome / Troll / Halfling (live: human, dwarf, high_elf, dark_elf, orc).
- **Weather systems** — crop/travel/battle visibility weather modifiers.
- **Wandering beasts** — roaming threats that pressure kingdoms until defeated.

### Polish and Management

- **Custom kingdom banner / sigil generator**
- **Email / push notifications** — opt-in player alerts (not security-auditor email helpers).
- **Customizable palace UI** — dashboard that evolves visually with kingdom level.

---

## Notes

- Admin UI **Evolution → Wishlist** seeds from `db/init-data.js` only when the table is empty. Completing/nixing items here does not auto-edit an existing DB.
- Prefer finishing partial systems over rebuilding them.
- Parallel wishlist copy in `CHANGELOG.md` “Wishlist — Future Additions” should stay aligned with this file.
