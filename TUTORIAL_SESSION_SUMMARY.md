# Narmir Reborn - 5,000 Turn Session Summary
## Validated New Player Tutorial Source Notes

**Executed:** 2026-06-30  
**Run Target:** 5,000 turns  
**Run Result:** Completed successfully  
**Kingdom:** `codex_local` / `Codex Dominion`

---

## Executive Summary

This session completed a real 5,000-turn progression run and produced a usable tutorial base for new players.

What we confirmed:
- Early game should prioritize housing, farms, granaries, and schools.
- School selection is gated by regular spellbook research reaching 100.
- Barracks are the hard gate for broad troop growth.
- The economy can scale cleanly through the late game when the turn engine is stable.
- The planner needs to respect build-queue caps and available slots more carefully.

---

## Final Kingdom Snapshot

- Turn: 5000
- Level: 89
- Gold: 72,164,285
- Food: 471,946
- Population: 208,048
- Happiness: 100
- School: conjuration
- Research focus: military
- Research: economy 212, construction 196, military 223, spellbook 213
- Buildings: farms 136, granaries 12, schools 9, housing 219, guard towers 2
- Troops: researchers 900, engineers 900, mages 320, fighters 169, rangers 333

Live end-state notes from the final kingdom snapshot:
- The kingdom stayed stable and non-confrontational.
- The build queue became saturated with markets, libraries, mage towers, vaults, taverns, granaries, schools, and outposts.
- That saturation is a planner issue, not a core gameplay failure.

---

## What We Learned

1. Early schooling matters more than the old draft implied.
2. Regular spellbook research is the prerequisite for school choice.
3. Conjuration is a viable non-combat school for a peaceful run.
4. Housing runs into wood pressure and cap pressure long before the late game.
5. Markets are useful, but the planner must stop over-ordering them when slot space is tight.
6. Engineers should be reallocated with current queue capacity in mind.

---

## Bugs And Warnings

- `POST /kingdom/build-allocation` intermittently returned `500 Failed to set build allocation`.
- `POST /kingdom/build-queue` repeatedly rejected oversized market and mage tower batches.
- Housing construction periodically paused because of wood shortages.
- None of those blocked the 5,000-turn run.

---

## Tutorial Draft Notes

- Start with food and housing.
- Build schools before pushing researcher growth hard.
- Get to spellbook 100, then choose a school.
- Keep an eye on queue size before adding more markets or mage towers.
- Use the late game to stabilize the economy, not to brute-force more infrastructure than the queue can hold.

---

## Source Files

- [Validated run report](C:\Users\king_\Narmir_Reborn\docs\CODEX_LOCAL_5000_TURN_REPORT.md)
- [Run log](C:\Users\king_\Narmir_Reborn\docs\CODEX_LOCAL_5000_TURN_LOG.json)
