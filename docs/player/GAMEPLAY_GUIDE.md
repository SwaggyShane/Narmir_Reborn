# Narmir Reborn Gameplay Guide

**Last Updated:** 2026-06-30

This is a concise, code-backed overview of the current game systems.

---

## Starting a Kingdom

Registration creates both a player account and a kingdom.

At creation time the server assigns:
- a race
- a region
- starting buildings
- starting land
- starting population
- starting troops
- starting resources

Supported races:
- `human`
- `high_elf`
- `dwarf`
- `dire_wolf`
- `dark_elf`
- `orc`
- `vampire`
- `wood_elf`
- `ogre`

---

## Core Systems

The main gameplay layers are:
- turns
- buildings and construction
- troops and warfare
- research and magic
- expeditions
- economy and market activity
- heroes
- fragments and synergies
- goals and progression

---

## Turns

Turn advancement is a central action route:
- `POST /api/kingdom/turn`

Turn processing can affect:
- resources
- happiness
- troop readiness
- hero progression
- expeditions
- news
- seasonal and regional effects

---

## Buildings and Allocation

Current gameplay routes support:
- build queue management
- direct build actions
- demolition and cancel flows
- engineer allocation
- training allocation
- resource-build allocation
- shrine, library, mausoleum, and tower workflows
- smithy workflows for tools and purchases

Important route surfaces:
- `/api/kingdom/build-queue`
- `/api/kingdom/build`
- `/api/kingdom/build-allocation`
- `/api/kingdom/resource-build-allocation`
- `/api/kingdom/training-allocation`

---

## Warfare

Current warfare includes:
- attacks
- covert actions
- spells
- war log reporting
- defense overview
- spy reports
- bounty interactions

Combat should be referred to simply as **combat** moving forward.

The repo also includes the detailed combat simulation code used for larger combat validation work.

Primary route file:
- [routes/kingdom-warfare.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-warfare.js)

---

## Research and Magic

Current systems include:
- research allocation
- research focus
- spellbook progression
- school selection
- offensive and defensive spell routes

Primary route files:
- [routes/kingdom-research.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-research.js)
- [routes/kingdom-warfare.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-warfare.js)

---

## Expeditions

The current expedition system supports:
- starting expeditions
- listing active and completed expeditions
- acknowledging completed expeditions
- cancelling expeditions
- clearing expedition history
- resource expeditions and scouting flows in gameplay routes

Named expedition types in current exploration routes:
- `scout`
- `deep`
- `dungeon`
- `mountain`

Primary route file:
- [routes/kingdom-exploration.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-exploration.js)

---

## Economy

Economy-related gameplay includes:
- market buy/sell
- economy overview
- trade offers
- trade routes
- mercenary hiring and dismissal
- building/resource upgrades tied to economic play

Primary route file:
- [routes/kingdom-economy.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-economy.js)

---

## Heroes

Hero gameplay currently supports:
- listing heroes
- viewing available classes
- recruiting heroes

Hero capacity depends on castles.

Primary route file:
- [routes/hero.js](C:\Users\king_\Narmir_Reborn\routes\hero.js)

---

## Forum and Social

The repo includes:
- forum boards and topics
- posting and moderation
- global chat
- direct messaging / chat-related socket flows
- Discord linking routes

Primary files:
- [routes/forum.js](C:\Users\king_\Narmir_Reborn\routes\forum.js)
- [routes/discord.js](C:\Users\king_\Narmir_Reborn\routes\discord.js)
- [game/sockets.js](C:\Users\king_\Narmir_Reborn\game\sockets.js)

---

## Fragments, Attunements, and Synergies

The fragment system includes:
- attunement state
- available attunements
- fragment assignment and removal
- synergy status
- synergy cooldowns
- active synergy abilities

Primary supporting files:
- [routes/kingdom-gameplay.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-gameplay.js)
- [game/fragment-attunements.js](C:\Users\king_\Narmir_Reborn\game\fragment-attunements.js)
- [game/fragment-synergies.js](C:\Users\king_\Narmir_Reborn\game\fragment-synergies.js)

---

## Route Truth

When gameplay docs and old notes disagree, use the route files and engine code as truth.

Primary files:
- [routes/kingdom-gameplay.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-gameplay.js)
- [routes/kingdom-exploration.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-exploration.js)
- [routes/kingdom-research.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-research.js)
- [routes/kingdom-warfare.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-warfare.js)
- [game/engine.js](C:\Users\king_\Narmir_Reborn\game\engine.js)
