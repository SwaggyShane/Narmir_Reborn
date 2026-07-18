# Narmir Reborn FAQ

**Last Updated:** 2026-06-30

Short answers based on the current repo.

---

## How do I create an account?

Use the register flow with:
- username
- password
- kingdom name
- email

The server creates both the player and the starting kingdom in one step.

---

## Do I log in with email or username?

Current login uses:
- `username`
- `password`

---

## How do turns work?

You can advance a turn from the game UI, and the server also regenerates turns over time. Many actions consume turns, especially warfare, expeditions, and some crafting flows.

---

## What are the main game loops?

The current codebase centers on:
- kingdom growth
- building and engineer allocation
- troop hiring and warfare
- research and spellbook progression
- expeditions
- economy and market activity
- hero recruitment

---

## How does combat work?

Combat is documented moving forward as **combat**.

The repo contains the current combat implementation plus the newer detailed combat simulation code that covers:
- troop HP and damage
- injuries
- cleric healing
- war machine crew requirements
- wall HP
- equipment stockpiles

---

## What expedition types exist?

Current expedition routes support:
- `scout`
- `deep`
- `dungeon`
- `mountain`

Expeditions use rangers, sometimes fighters, and consume food when launched.

---

## Are expeditions deleted automatically?

Completed expeditions can be:
- listed
- acknowledged individually
- cleared in bulk

There are also resource-node and interception systems elsewhere in the gameplay routes.

---

## Are there heroes?

Yes.

Current hero routes support:
- listing heroes
- listing available classes
- recruiting heroes

Hero slot count depends on castles.

---

## Is there a forum?

Yes.

The repo supports:
- public board/topic browsing
- authenticated posting
- forum profile settings
- moderation tools
- reports and bans

---

## Is there a mobile app?

The repository does not provide a mobile app implementation or mobile store publishing flow. Treat the web client as the documented surface unless that changes.

---

## Is there premium, battle pass, or cosmetics support?

Not as a documented live feature in the current gameplay code. There are planning and monetization documents in the repo, but those are not the same as implemented player systems.

---

## Does the game support 2FA, password reset, or email verification?

Those flows are not documented here as active features because they are not present in the current auth routes.

---

## Where should I look for route truth?

Primary route files:
- [routes/auth.js](C:\Users\king_\Narmir_Reborn\routes\auth.js)
- [routes/kingdom-gameplay.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-gameplay.js)
- [routes/kingdom-exploration.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-exploration.js)
- [routes/kingdom-research.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-research.js)
- [routes/kingdom-warfare.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-warfare.js)
- [routes/forum.js](C:\Users\king_\Narmir_Reborn\routes\forum.js)
