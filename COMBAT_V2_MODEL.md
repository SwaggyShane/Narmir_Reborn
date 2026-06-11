# Combat V2 Model

**Status:** Phase 3 local specification  
**Scope:** Design and integration guardrails only. Do not treat this as final balance tuning.

## Intent

Combat V2 replaces aggregate percentage combat with individual troop durability and damage.

The core model is HP and DMG:

- **HP** is the defensive side of a troop. Armor research, troop level, and racial modifiers increase how long an individual troop survives.
- **DMG** is the offensive side of a troop. Weapon research, troop level, and racial modifiers increase how much pressure an individual troop applies.
- Injured troops persist after battle instead of every casualty being immediately deleted.
- Clerics matter because they prevent deaths and support healing.
- Walls and defensive structures are HP pools that must be damaged, bypassed, or overwhelmed.
- War machines should be strong, but only when crewed and properly represented in diagnostics.

## Base Unit Stats

Current V2 base stats from `game/combat-new.js`:

| Unit | Base HP | Base DMG | HP/Level | DMG/Level |
| --- | ---: | ---: | ---: | ---: |
| fighters | 250 | 25 | 2.0 | 1.0 |
| rangers | 100 | 15 | 0.8 | 0.6 |
| mages | 25 | 30 | 0.2 | 1.2 |
| clerics | 150 | 15 | 1.2 | 0.6 |
| ninjas | 50 | 10 | 0.4 | 0.4 |
| thieves | 75 | 15 | 0.6 | 0.6 |
| engineers | 100 | 0 | 0.8 | 0 |
| war_machines | 500 | 40 | 4.0 | 1.6 |

## Stat Formulas

Individual troop HP:

```text
HP = (base HP * troop racial modifier) + (armor research * armor equipment coverage) + (troop level * HP level scale)
```

Individual troop DMG:

```text
DMG = (base DMG * troop racial modifier) + ((weapon research * weapon equipment coverage) * 0.1) + (troop level * DMG level scale)
```

Research roles:

- `res_armor` increases troop HP. It should not be treated as direct attack power.
- `res_weapons` increases normal troop DMG.
- `res_war_machines` increases war machine DMG.
- magic attacks may use magic research as their DMG research source, but that must be explicit in reports.
- `armor_stockpile` and `weapons_stockpile` gate whether troops can benefit from armor and weapon research. A troop without matching stockpiled gear does not receive that equipment research contribution.
- When an equipped troop dies on the field, its equipped weapon and/or armor is removed from that troop owner's stockpile, then recovered into the defender's stockpile. Injured troops retain their gear.
- Equipment quality is tracked in `equipment_levels` as `{ weapons, armor }`, using the same `{ level, xp, count }` shape as troop XP.
- Captured equipment keeps its source quality and dilutes into the defender's existing equipment average by count, following the same weighted-average principle as troop XP dilution.
- When `equipment_levels` is absent for legacy kingdoms, V2 derives an initial equipment quality from the kingdom's research scale: `res_weapons / 10` for weapons and `res_armor / 10` for armor.

## Race Modifiers

V2 should use the canonical config data instead of local hardcoded race tables:

- `config.RACE_BONUSES` for broad race modifiers.
- `config.TROOP_RACE_BONUS` for troop-specific modifiers.
- `config.WALL_STRENGTH_MULT` for defensive structure durability when applicable.

Troop-specific racial bonuses should apply to the unit they name. Examples:

- dwarf fighters and engineers are stronger individually.
- high elf mages and clerics are stronger individually.
- dire wolf fighters and rangers are stronger individually.
- dark elf ninjas, thieves, and rangers are stronger individually.
- vampire thieves and clerics are stronger individually.

War machines should use the dwarf `war_machines` broad bonus only if the design wants dwarf machines themselves stronger. That is separate from the dwarf engineer perk.

## Injury States

Injured troops are stored in `injured_troops` as JSON:

```json
{
  "fighters": [{ "hp": 200, "max_hp": 320 }],
  "rangers": [{ "hp": 40, "max_hp": 180 }]
}
```

Current injury bands:

| State | HP Percent | Healing Speed |
| --- | ---: | ---: |
| healthy | 75-100 | 1.0 |
| lightly_injured | 50-74 | 0.8 |
| moderately_injured | 25-49 | 0.6 |
| heavily_injured | 1-24 | 0.4 |
| dead | 0 | 0 |

Healthy troop counts and injured pools must not double-count the same unit. When a healthy troop takes damage and survives, it should move out of the healthy count and into `injured_troops`.

Combat damage is resolved as individual in-memory hits, not as one cumulative damage pool. A participating fighter hit damages one target unit; unused overkill does not spill into the next target. The database still stores healthy troops as aggregate counts, then V2 compresses the post-combat result back into healthy counts plus individual `injured_troops` records.

Critical hits are the lethality layer on top of individual hits. Each participating unit rolls an independent critical chance based on troop type and level. A critical hit multiplies that one unit's damage and can finish a target if the hit drives it into moderate or heavy injury. This creates visible kills without returning to cumulative spillover damage.

## Unit Roles

Fighters:

- Main front-line military unit.
- Should contribute meaningful DMG and absorb damage through high HP.

Rangers:

- Mid-line military unit.
- Should contribute less direct pressure than fighters but remain relevant, especially for race bonuses.

Mages:

- High DMG, low HP.
- Should participate in magic combat and spell-driven battle paths once those are wired.

Clerics:

- Support and sustain.
- Should save or heal friendly troops, not enemy troops.
- Should be visible in diagnostics as rescues, healing applied, and deaths prevented.

Ninjas:

- Covert assassination.
- Should prioritize valuable backline/support targets only through an explicit target policy.

Thieves:

- Sabotage and disruption.
- Current V2 records sabotage but does not apply it. Integration must decide whether sabotage reduces war machine DMG, crew efficiency, wall damage, or another concrete metric.

Engineers:

- War machine crew and ladder/wall specialist.
- Dwarf engineer perk is intended at level 25, not level 5.
- Engineer count and effective engineer level must be reported.

War machines:

- Heavy siege/backline damage.
- Must honor crew requirements before contributing full DMG.
- Dwarf solo-crew perk should reduce crew requirement only when engineer level is at least 25.
- Diagnostics must report machines owned, machines crewed, machines inactive, and total war machine DMG.

## Battle Flow

The intended V2 flow should be:

1. Load attacker and defender troop counts, injured pools, research, levels, race modifiers, walls, and defensive structures.
2. Calculate unit HP budgets by type.
3. Calculate unit DMG budgets by type.
4. Apply crew requirements to war machines before adding their DMG.
5. Apply target focus and line-distance modifiers where appropriate.
6. Resolve wall/structure interaction before or alongside troop damage, depending on attack type.
7. Apply damage into individual HP pools, producing injured and dead troops by type.
8. Apply cleric death prevention and healing to friendly troops.
9. Apply special mechanics such as ninjas, thieves, ladders, and wall damage.
10. Persist healthy troop count changes, injured troop JSON, and wall HP.
11. Return a report compatible with the current V1 caller contract.

## Walls And Defensive Structures

Current wall HP ratings:

- fortified: 100 HP per wall
- keep: 500 HP per wall
- citadel: 1000 HP per wall

Wall HP should be stored in `wall_hp` and reported before and after combat.

Ladders currently damage 2% of max wall HP per successful hit. Engineer hit chance is:

```text
hit chance = engineer level * 0.5%
```

Integration must make sure ladder hit chance uses the attacker's engineers and engineer level, not the defender's.

## Required Adapter Contract

The V2 adapter must preserve the current engine-level result shape:

- `win`
- `report`
- `attackerUpdates`
- `defenderUpdates`
- `atkEvent`
- `defEvent`
- optional `shameEvent`

This lets V2 be feature-flagged without forcing routes, sockets, or the frontend to change in the same step.

## Required Diagnostics

Before balance testing resumes, every V2 combat report should include:

- attacker and defender HP budget by type
- attacker and defender DMG budget by type
- healthy troop counts before and after
- injured troop counts before and after
- dead troops by type
- cleric rescues and healing applied
- war machines owned, crewed, inactive, and effective DMG
- engineers available and effective engineer level
- ladders sent, active, successful hits, and wall damage
- wall HP before and after
- structure modifiers applied
- race modifiers applied
- research values used for HP and DMG
- win chance inputs, not only final win chance

## Current Scaffold Defects To Fix Before Integration

These are problems in the current V2 files, not intended design:

- `combat-resolver.js` has an async `executeCombat(db, ...)`, but active `engine.js` combat is currently sync. The adapter must either make V2 pure/sync or introduce an async route-safe call path deliberately.
- The older feature-flag wrapper commit is too shallow to copy directly because it did not actually route through `executeCombat`.
- `combat-resolver.js` uses a local hardcoded race table. It should use canonical config.
- On a repelled attack, `executeCombat` currently applies defender casualties only. That appears inverted or unfinished.
- Attacker clerics currently rescue defender injuries after attacker victory. Clerics should operate on their own side unless a spell or design rule explicitly says otherwise.
- Wall ladder hit chance currently uses defender engineers. It should use attacker engineers and attacker engineer level.
- Thief sabotage is recorded but not applied.
- War machine crew requirements are missing from V2 power calculation.
- Dwarf engineer solo-crew perk must be level 25.
- `res_armor` is not part of power, which is correct for HP/DMG, but reports must expose HP budgets so armor is visible.

## Non-Goals For Phase 3

- Do not tune dwarf, mage, wall, fragment, or war-machine numbers yet.
- Do not push to remote.
- Do not merge or cherry-pick the old combat branch wholesale.
- Do not treat V1 balance test reports as final V2 evidence.
