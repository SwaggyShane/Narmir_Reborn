# Narmir Reborn - Terminology & Naming Standards

This document standardizes terminology across the codebase to improve consistency and maintainability.

## Unit Types

**Standard Form: Plural (as database columns)**

All unit counts in database use plural forms:
- `fighters`, `rangers`, `clerics`, `mages`, `thieves`, `ninjas`
- `researchers`, `engineers`, `scribes`, `thralls`

**Config References:** Use a mix of singular and plural forms depending on the config object
- Plural keys: `config.TROOP_RACE_BONUS.fighters`
- Singular keys: `config.SUPPORT_CAP_RACE.high_elf.researcher`
- Database: `kingdoms.fighters`

**In Code:** 
- Use lowercase plural when referencing DB columns: `k.fighters`
- Check config structure for singular/plural usage

## Research Disciplines

**Naming Convention:** `res_<discipline>` for research columns

Current fields:
| Field | Meaning | Range |
|-------|---------|-------|
| `res_spellbook` | General spellbook (Researchers only) | 0-100+ |
| `res_economy` | Economic research | 0-100+ |
| `res_weapons` | Weapon research | 0-100+ |
| `res_armor` | Armor research | 0-100+ |
| `res_military` | Military tactics | 0-100+ |
| `res_construction` | Building techniques | 0-100+ |
| `res_war_machines` | War machine design | 0-100+ |
| `res_attack_magic` | Offensive spells | 0-100+ |
| `res_defense_magic` | Defensive spells | 0-100+ |
| `school_spellbook` | School-specific spells (Mages only) | 0-100+ |

**Notes:**
- `res_` prefix standard for base research
- `school_` prefix for school-specific research
- All use snake_case in database
- Allocation fields: `research_allocation` (JSON)

## Building Naming

**Database Columns:** Always use `bld_<building_name>` prefix

Examples:
- `bld_farms`, `bld_granaries`, `bld_barracks`
- `bld_guard_towers`, `bld_mage_towers`, `bld_shrines`
- `bld_vaults`, `bld_banks`, `bld_markets`

**Config References:**
```javascript
// Good: Config keys use plain names (no bld_ prefix, except in BUILDING_TIERS)
config.BUILDING_LAND_COST.farms
config.BUILDING_COST.granaries

// Exception: BUILDING_TIERS uses bld_ prefix (maps to bld_* columns)
config.BUILDING_TIERS.bld_farms // → queries kingdoms.bld_farms
```

**Avoid:**
- Do NOT use `farms` without `bld_` prefix in context of buildings
- `farms` suffix can mean: farm upgrades, farm level, etc. Always clarify with `bld_` prefix

## Resource Types

### Primary Resources
- `gold` - Currency (no prefix needed, unambiguous)
- `food` - Food supply
- `land` - Territory in acres

### Raw Materials
- `wood`, `stone`, `iron`, `coal`, `steel`
- Stored in direct columns: `kingdoms.wood`, etc.

### Manufactured Resources
- `war_machines` - Military equipment
- `weapons_stockpile` - Stored weapons
- `armor_stockpile` - Stored armor

### Tools (Crafting Supplies)
- `hammers_stored` - Blacksmith tools
- `scaffolding_stored` - Construction tools
- `blueprints_stored` - Engineering blueprints

**Consistency Issue:** `hammers_stored` vs `weapons_stockpile`
- Historical inconsistency in naming
- Standard going forward: `<item>_stored` for tool/supply storage
- Example: If adding rope storage, use `rope_stored` (not `rope_stockpile`)

## Numerical Quantities

### Turns
- `turn` - Current game turn number (integer)
- `turns_stored` - Available turns for kingdom
- `turns_left` - Remaining turns for expedition
- `turns_needed` - Turns required to complete action
- `food_surplus_turns` - Turns until food runs out if surplus continues
- `food_shortage_turns` - Turns in shortage status

### Capacity/Storage
- `food_storage` - Food storage capacity
- `population` - Current population
- `capacity` - Generic capacity (use sparingly, specify type)

## Economic Terms

### Financial Institutions
- `bld_vaults` - Secure storage (buildings)
- `bld_banks` - Trading/commerce (buildings)
- `ledger` - Abstract accounting system

**Clarification:** These are building types with distinct purposes:
- Vault = secure storage (uses `bank_upgrades` column)
- Bank = trading, market access (uses `bank_upgrades` column)

### Upgrade Systems
- `bank_upgrades` - Upgrades for both vault (security/capacity) and bank (trading/commerce)
- `market_upgrades` - Market-related upgrades

## Allocation Naming

All allocation fields use this pattern: `<type>_allocation`

Examples:
- `research_allocation` - Where to assign researchers
- `training_allocation` - Where to assign fighter training
- `build_allocation` - Building project allocation
- `mage_tower_allocation` - Mage tower studies
- `shrine_allocation` - Shrine studies
- `library_allocation` - Library studies

**Format:** All store JSON objects
```javascript
{
  "researchers": 5,
  "fighters": 3,
  // etc.
}
```

## Combat & Warfare

### Actions
- `attack` - Military assault
- `defend` - Defense response
- `raid` - Targeted resource theft (covert)
- `spy` - Intelligence gathering (covert)
- `loot` - Robbery (covert)
- `assassinate` - Targeted unit destruction (covert)
- `sabotage` - Building damage (covert)

### Records
- `war_log` - Official military records
- `combat_log` - Detailed combat results
- `spy_reports` - Intelligence reports

## Expedition Types

Standard expedition types:
- `scout` - Small scouting mission (10 turns)
- `deep` - Deeper exploration (25 turns)
- `dungeon` - Dungeon raid (50 turns)

## School of Magic

When implemented, use these patterns:
- `school_of_magic` - Selected school name/type
- `school_spellbook` - School-specific research level
- `school_upgrades` - School building upgrades (JSON)
- `school_lore` - Flavor text for school

## Status Fields

Status values use lowercase with underscores:
- `idle` - No activity
- `active` - Currently processing
- `complete` - Finished
- `stuck` - Error/stuck state
- `searching` - In progress search

## Prefixes & Conventions

| Prefix | Meaning | Examples |
|--------|---------|----------|
| `bld_` | Building column | `bld_farms`, `bld_towers` |
| `res_` | Research column | `res_economy`, `res_spellbook` |
| `idx_` | Database index | `idx_kingdoms_player` |
| `is_` | Boolean field | `is_ai`, `is_read` |
| `_allocation` | Resource allocation | `research_allocation` |
| `_upgrades` | Upgrade data (JSON) | `bank_upgrades` |

## Migration Path for Inconsistencies

Future migrations should standardize:
1. ✅ **Phase 1 (Complete):** Documented inconsistencies
2. **Phase 2 (Pending):** Add compatibility layer (alias functions)
3. **Phase 3 (Pending):** Gradual column migration with dual-column support
4. **Phase 4 (Pending):** Cleanup phase - remove old columns

Current status: **Phase 1 documentation complete**

## Related Concepts to Clarify

### Mages vs Researchers
- `researchers` - Units that study general spellbook (0-100)
- `mages` - Units that study advanced magic (spellbook 100+, school_spellbook 0+)
  - Same base unit, different designation based on research level

### Heroes vs Leaders
- `heroes` - Named special units with classes and progression
- Different from generic unit types (fighters, rangers, etc.)

---

**Last Updated:** 2026-05-30
**Status:** Active (ongoing standardization)
