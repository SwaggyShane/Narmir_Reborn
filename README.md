# Narmir Reborn — Land of Magic and Conquest

A browser-based multiplayer kingdom management game with real-time chat, turn-based strategy, and deep race customisation. Built with Node.js, Express, Socket.io, PostgreSQL, and React.

---

## Live

**Game:** https://narmirreborn.com  
**Hosting:** Railway (PostgreSQL on Railway)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express |
| Real-time | Socket.io |
| Database | PostgreSQL (via `pg` driver) |
| Auth | JWT — httpOnly cookie + localStorage fallback |
| Frontend | React 19 + Vite |
| Discord | discord.js 14 |
| Hosting | Railway |

---

## Setup

```bash
npm install
```

**Environment variables:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `ADMIN_SECRET` | Password for admin panel access |
| `PORT` | Server port (default: 3000) |
| `DISCORD_BOT_TOKEN` | Discord bot token (optional) |
| ~~`USE_COMBAT_V2`~~ | Removed — Combat V2 is the only military path |

**Run:**

```bash
npm start           # production
npm run dev         # development
npm run build       # compile React client (Vite)
npm run bot         # start Discord bot separately
```

**Smoke and test scripts:**

```bash
npm run smoke:combat-v2        # Advanced combat adapter smoke test
npm run scenario:combat-v2     # Advanced combat scenario runner
npm run route-smoke:combat-v2  # Advanced combat route persistence smoke
npm run sweep:combat-v2-broad  # Advanced combat broad balance sweep
```

---

## Documentation Map

### For Developers
- **[CLAUDE.md](CLAUDE.md)** — PR workflow, quality checks, branching strategy
- **[TODO.md](TODO.md)** — Development roadmap and task tracking (current source of truth)
- **[.claude/WORKFLOW-REQUIRED.md](.claude/WORKFLOW-REQUIRED.md)** — Enforcement checklist before commits/pushes
- **[MAINTENANCE.md](MAINTENANCE.md)** — System health audit, architecture status
- **[ARCHIVAL.md](ARCHIVAL.md)** — Completed tracks and features (historical record)

### For Setup & Deployment
- **[WINDOWS_LOCAL_SETUP.md](WINDOWS_LOCAL_SETUP.md)** — Local dev environment on Windows
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** — Pre-production deployment verification
- **[docs/RAILWAY_SETUP.md](docs/RAILWAY_SETUP.md)** — Railway deployment guide
- **[RAILWAY_SECRETS.md](RAILWAY_SECRETS.md)** — Production secrets management in Railway
- **[docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)** — Database backup and recovery procedures

### For Operations & Troubleshooting
- **[docs/SUPPORT_RUNBOOK.md](docs/SUPPORT_RUNBOOK.md)** — Common issues, recovery, escalation (10+ scenarios)
- **[ALERT_RUNBOOK.md](ALERT_RUNBOOK.md)** — On-call alert response guide
- **[BACKUP_RESTORE_RUNBOOK.md](BACKUP_RESTORE_RUNBOOK.md)** — Backup and restore procedures

### For Technical Reference
- **[docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md)** — Complete API reference (900+ lines with examples)
- **[HTTPS_ENFORCEMENT.md](HTTPS_ENFORCEMENT.md)** — HTTPS and TLS configuration
- **[MONITORING_ALERTING_GUIDE.md](MONITORING_ALERTING_GUIDE.md)** — Error tracking and alerting setup
- **[RATE_LIMITING_GUIDE.md](RATE_LIMITING_GUIDE.md)** — Rate limiter setup and config
- **[game/ARCHITECTURE.md](game/ARCHITECTURE.md)** — Live architecture / verified status

### For Security & Compliance
- Security findings: re-run `tools/security-auditor` (generates `AUDIT_REPORT.md`); historical write-ups live in [ARCHIVAL.md](ARCHIVAL.md)
- Parameterized queries + middleware are the live controls (see `routes/middleware.js`, `utils/numeric-validation.js`)

### For Performance & Testing
- **[LOAD_TEST_EXECUTION_GUIDE.md](LOAD_TEST_EXECUTION_GUIDE.md)** — Run load tests (5,000+ concurrent)
- **[TESTING_CHECKLISTS.md](TESTING_CHECKLISTS.md)** — QA test plans by system

### For Players
- **[GAMEPLAY_GUIDE.md](GAMEPLAY_GUIDE.md)** — Complete game mechanics reference
- **[FAQ.md](FAQ.md)** — Frequently asked questions
- **[NEW_PLAYER_TUTORIAL.md](NEW_PLAYER_TUTORIAL.md)** — Turn-by-turn tutorial notes

### Reference & Standards
- **[CHANGELOG.md](CHANGELOG.md)** — Feature history and release notes
- **[TERMINOLOGY.md](TERMINOLOGY.md)** — Naming standards and conventions
- **[TESTING_CHECKLISTS.md](TESTING_CHECKLISTS.md)** — QA test plans by system

---

## Project Structure

```
narmir-server/
├── index.js                      # Entry point — Express, Socket.io, turn regen
├── discord-bot.js                # Discord integration bot
├── game/
│   ├── engine.js                 # Core game logic — upkeep, spells, expeditions, XP
│   ├── turn.js                   # Per-turn processing — gold, food, research, happiness
│   ├── combat.js                 # Current combat engine (aggregate power/percentage)
│   ├── combat-new.js             # Advanced combat model — individual HP/DMG/injury (feature-flagged)
│   ├── combat-resolver.js        # Advanced combat execution engine
│   ├── happiness.js              # Happiness calculation, recovery, rebellion triggers
│   ├── magic.js                  # Spell casting, school validation, mana costs
│   ├── heroes.js                 # Hero classes, recruitment, leveling, passive bonuses
│   ├── expeditions.js            # Expedition rewards, attrition, ultra-rare drops
│   ├── construction.js           # Building queue, engineer allocation
│   ├── economy.js                # Gold/food/trade calculations
│   ├── covert.js                 # Spy, loot, assassinate, sabotage
│   ├── mercenaries.js            # Mercenary hiring and management
│   ├── forge.js                  # Equipment crafting and upgrades
│   ├── fragment-synergies.js     # World fragment synergy definitions and effects
│   ├── fragment-attunements.js   # Per-building fragment attunement effects
│   ├── fragment-bonus-manager.js # Fragment bonus calculation utility
│   ├── achievements.js           # Achievement tracking and unlocks
│   ├── goals.js                  # Kingdom goals and milestones
│   ├── prestige.js               # Prestige system
│   ├── trade-routes.js           # Trade route income and management
│   ├── xp.js                     # XP curves and leveling logic
│   ├── config.js                 # All game constants, races, spells, fragments
│   └── sockets.js                # Socket.io event handlers — chat, combat, real-time
├── routes/
│   ├── auth.js                   # Register, login, logout
│   ├── kingdom.js                # All kingdom actions — build, hire, attack, research, expedition
│   ├── admin.js                  # Admin panel routes
│   ├── hero.js                   # Hero-specific routes
│   ├── forum.js                  # In-game forum
│   ├── discord.js                # Discord channel sync
│   └── middleware.js             # requireAuth JWT middleware
├── db/
│   └── schema.js                 # Table creation + safe column migrations on boot
├── client/
│   ├── index.html                # Main game shell
│   ├── src/
│   │   ├── main.jsx              # React entry point
│   │   └── components/react/     # React panel components (34 panels)
│   ├── admin.html                # React admin entry (Vite)
│   └── src/admin/                # React admin panels
├── test-combat-harness/          # Combat verification scripts
└── tools/security-auditor/       # Security audit tooling
```

---

## Races

Nine playable races, each with distinct stat profiles:

| Race | Strengths | Weaknesses |
|---|---|---|
| **Human** | Economy ×1.50, balanced across all systems | No dominant weakness |
| **High Elf** | Research ×1.25, Magic ×1.20, Rare finds ×1.40 | Military ×0.90, Food storage ×0.70 |
| **Dwarf** | Construction ×1.20, War machines ×1.25, Economy ×1.20, Iron ×1.30 | Magic ×0.75, Research ×0.90 |
| **Orc** | Military ×1.20, Iron ×1.20, Economy ×1.10 | Research ×0.80, Magic ×0.65 |
| **Dire Wolf** | Military ×1.30, Expedition speed ×1.40, Food storage ×2.0 | Magic ×0.25, Research ×0.60, Economy ×0.80 |
| **Dark Elf** | Covert ×1.25, Stealth ×1.30, Rare finds ×1.25 | Military ×0.85, Happiness ×0.90 |
| **Vampire** | Covert ×1.25, Stealth ×1.20, Military ×1.15 | Food storage ×0.50, Economy ×0.90 |
| **Wood Elf** | Wood yield ×1.50, Expedition speed ×1.20, Rare finds ×1.30 | Iron ×0.75, Stone ×0.80 |
| **Ogre** | Military ×1.25, Iron ×1.40, Stone ×1.30 | Research ×0.70, Economy ×0.85 |

Races also unlock a level-25 unit milestone bonus (e.g. Dwarf engineers solo-crew war machines, High Elf mages produce double scrolls).

---

## Core Game Loop

1. **Turns** regenerate at +7 every 25 minutes (max 400 stored)
2. Spend turns to: build, research, hire troops, attack, cast spells, send expeditions
3. Engineers build continuously from allocation — no per-turn turn cost
4. Gold produced each turn: land × tax rate × economy research × race bonus
5. Support units (researchers, engineers, scribes) are housed in buildings; no upkeep
6. All units gain XP from activity, leveling up to +50% effectiveness at level 100
7. **Happiness** affects population growth, production efficiency, and combat power — managed through food, safety, entertainment research, tax rate, and prosperity
8. **Heroes** can be recruited and leveled, providing passive bonuses to their kingdom

---

## Magic Schools

Kingdoms choose one school of magic after reaching spellbook 100. School spells cost 15% less spellbook to cast and unlock Tier 5 Ascendant spells.

| School | Focus |
|---|---|
| **Abjuration** | Protection, wards, barriers |
| **Conjuration** | Summoning, resources, healing |
| **Divination** | Intelligence, foresight, scrying |
| **Enchantment** | Mind control, troop manipulation |
| **Evocation** | Offensive elemental damage |
| **Illusion** | Deception, false armies, misdirection |
| **Necromancy** | Undead troops, life drain, death curses |
| **Transmutation** | Transformation, gold conversion, metamorphosis |

Each school has 25 spells across 5 tiers (Tier 1: minSB 100 → Tier 5: minSB 1000+).

---

## World Fragment System

Ten World Fragment types can be found on expeditions, studied, transcribed into hybrid blueprints, and applied permanently to buildings. Only one fragment can be applied per building; the choice is irreversible.

Fragment synergies activate when all 10 required fragments are placed across specific buildings — one synergy active at a time, with both passive bonuses (gold, mana, population, food, happiness) and a cooldown-gated active ability.

---

## Expeditions

| Type | Turns | Rangers required | Notes |
|---|---|---|---|
| Scout | 10 | Any | 5% map drop |
| Deep | 25 | Any | 15% map drop, 0.5% ultra-rare |
| Dungeon | 50 | Any | 25% map drop, 20% blueprint drop, 1% ultra-rare |
| Mountain | 100 | 10,000+ (rangers only) | Heavy avalanche attrition, Air Fragment, 2.5% ultra-rare |

Ultra-rare prizes include unique items, stat bonuses, and World Fragment drops. **The Throne of Nazdreg Grishnak** (0.1% on deep/dungeon) can only be found once per server.

---

## Combat

Combat is documented moving forward simply as **combat**.

The repo contains the current combat flow plus the more detailed simulation model covering troop HP, damage, injuries, cleric healing, war machine crew requirements, wall HP, equipment stockpiles, and critical hits.

---

## Production Documentation

Core production docs:

- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) — deployment readiness and rollout checks
- [RAILWAY_SECRETS.md](RAILWAY_SECRETS.md) — Railway environment and secret setup
- [HTTPS_ENFORCEMENT.md](HTTPS_ENFORCEMENT.md) — TLS, HSTS, and secure-cookie notes
- [BACKUP_RESTORE_RUNBOOK.md](BACKUP_RESTORE_RUNBOOK.md) — backup and restore procedures
- [RATE_LIMITING_GUIDE.md](RATE_LIMITING_GUIDE.md) — rate-limit configuration notes
- [MONITORING_ALERTING_GUIDE.md](MONITORING_ALERTING_GUIDE.md) — monitoring and alerting setup
- [LOAD_TEST_EXECUTION_GUIDE.md](LOAD_TEST_EXECUTION_GUIDE.md) — how to re-run load tests

---

## Chat & Moderation

Real-time global chat via Socket.io. Messages use username (not kingdom name).

**User commands:** `/me <action>` · `/msg <username> <text>`  
**Mod commands:** `/kick` · `/ban [reason]` · `/unban` · `/delete <id>`

Moderators assigned via admin panel. In-game forum also available for longer-form posts.

---

## Admin Panel

Access at `/admin` — React + Tailwind admin shell (login with an admin account).

Initial admin setup still uses `ADMIN_SECRET` via `/api/setup-admin` (see env table above).

**Tabs:** Manage · Kingdoms (editor, AI presets, bulk tools) · Events · Configs · Sounds · Prestige · Lore & Trips · Evolution (wishlist/changelog/notes) · Detailed Lists (fragments + spells) · Goals · Security Audit

**Legacy note:** The vanilla `public/admin.html` has been archived to `public/legacy/admin.html`. React admin is the canonical panel as of Ph6b (2026-06-26).

Admin migration to React + Tailwind panel is complete (see ARCHIVAL.md for history).

---

## The Throne of Nazdreg Grishnak

A tribute to a real player. The throne exists once in the entire game world and cannot be found again once discovered.

> *Nazdreg Grishnak · August 13, 1975 — August 19, 2012*
>
> "An orc who sat upon this throne once commanded armies and shaped the world.  
> His name is remembered. His legacy endures."

When found, every kingdom receives a news event and a global chat broadcast. The finder receives all stats +100, 1,000,000 gold, 1,000 land, 100,000 population, +50 happiness, and 50,000 fighters.

---

## Database

PostgreSQL connection via `DATABASE_URL`. Schema migrations apply automatically on boot (`db/schema.js`). No manual migration steps required for column additions.

For production schema changes: write migration SQL, test against a local `narmir_smoke` database, then execute via pgAdmin against Railway.

---

## License

Private project. All rights reserved.
