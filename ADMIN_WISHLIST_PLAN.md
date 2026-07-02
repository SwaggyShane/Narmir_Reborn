# Admin Wishlist Plan

This is a cleaned-up pass over the admin wishlist. Treat it as a backlog, not a promise that every item is still missing. I checked the repo for direct implementation evidence; most items still read as backlog, so only clearly adjacent or partially supported items are marked as such here.

Deeper audit note: I did not find enough code-backed evidence to promote any partial item to fully done, so the archive stays unchanged for now.

## Done / Archived

None confirmed from the current code scan.

## Partial

- Terrain advantages
  - Terrain and world-map infrastructure exists, but the combat modifier layer is not yet a fully defined system.
- Resource biomes
  - World-map and resource placement logic exist, but biome-to-material gameplay is still not a clean first-class system.
- Full iOS / Android PWA wrapping
  - The app has web delivery pieces, but I did not find a dedicated PWA wrapper implementation in the current code scan.
- Step-by-step interactive new player tutorial
  - There are onboarding/docs references, but I did not find a dedicated tutorial flow in code.

## Still Missing

### Gameplay

- Spell casting target history
  - Track the last valid target per spell and prefill it in the UI.
- Diplomacy
  - Add formal non-aggression pacts, tribute, and treaty state with server validation.
- Resource loans
  - Add player-to-player lending with repayment terms and delinquency handling.
- Espionage network
  - Build persistent intel accumulation for nearby kingdoms with server-side resolution.
- Religion / pantheon
  - Add deity selection, domain bonuses, and long-term allegiance effects.
- Laws & edicts
  - Let kingdoms enact policies with clear tradeoffs and a cooldown or upkeep cost.
- Prisoners of war
  - Support ransom, release, or execution flows with explicit combat outcomes.

### Combat

- Alliance war
  - Add alliance-level war declarations and shared hostility state.
- Artifact hunting
  - Build high-risk expedition content with rare combat rewards.
- Naval combat
  - Add ship-based conflict rules and ocean-zone engagement logic.
- Generals
  - Create commander units that provide morale or tactical bonuses during battle.
- Mercenary guilds
  - Add hireable factions with distinct unit mixes, upkeep, and contract limits.
- Terrain advantages
  - Apply biome-aware combat modifiers in the authoritative combat resolver.
- Naval trade routes
  - Extend route systems so sea lanes can be profitable but vulnerable.

### Economy

- Auction house
  - Add a marketboard for unique gear and captured heroes with listing controls.
- Prestige economy
  - Make prestige grant persistent market or economic bonuses with clear caps.
- Caravans
  - Represent physical trade routes that can be intercepted or protected.
- Smuggling rings
  - Add hidden trade paths that bypass some taxes but increase risk.
- Global market history
  - Add price history charts and trend views for key commodities.

### World

- More races
  - Add new race packages only after the core region and balance model is stable.
- Dungeons and raids
  - Introduce cooperative PvE content with shared objectives and rewards.
- Resource biomes
  - Tie land regions to specific materials and terrain identity.
- Weather systems
  - Add weather-driven modifiers for crops, travel, and battle visibility.
- Dynamic world events
  - Add global events with meaningful but bounded modifiers.
- Wandering beasts
  - Add roaming threats that pressure random kingdoms until defeated.
- Terrain advantages
  - Make terrain matter in both combat and travel, not just visually.

### Polish and Management

- Custom kingdom banner / sigil generator
  - Add a simple banner composer with saved presets and preview.
- Dark / light / high-contrast themes
  - Ship accessible theme toggles that work across the whole UI.
- Email / push notifications
  - Add opt-in alerts for attacks, expeditions, and other state changes.
- Customizable palace UI
  - Let the player dashboard evolve visually as the kingdom levels up.

## Notes

- Anything already present in the codebase should be treated as partial completion, not duplicated work.
- When a wishlist item overlaps with an existing system, the next step is to tighten or finish that system instead of rebuilding it.
- If a future scan finds a direct implementation for one of the missing items, move it into the archive with a date and remove it from this list.
