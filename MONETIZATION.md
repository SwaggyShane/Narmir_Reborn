# Narmir Reborn — Monetization Roadmap

**Status:** Planning  
**Last updated:** 2026-06-26

---

## 1. Guiding Principles

- **Cosmetics over power.** Players pay to feel cool, not to win.
- **Ads are opt-in and rewarded.** Never interrupt gameplay — always exchange value.
- **Keep the base game fully free.** No paywalls on core mechanics.
- **Bound all paid advantages.** Any stat benefit must have a ceiling that free players can eventually reach.

---

## 2. Revenue Streams

### 2.1 Premium Race Variants

Unlock "prestige" versions of existing races with unique visual themes, flavor text, and minor cosmetic perks. Same base stats — differentiated by lore and aesthetics.

| Tier | Race Variant | Base Race | Theme |
|------|-------------|-----------|-------|
| 1 | Shadow Vampire | Vampire | Void/darkness aesthetic, purple tones |
| 1 | Ironborn Dwarf | Dwarf | Steampunk/mechanical theme |
| 2 | Celestial High Elf | High Elf | Divine/angelic, gold and white |
| 2 | Bloodfang Dire Wolf | Dire Wolf | Cursed/feral, red and black |
| 3 | Voidwalker Dark Elf | Dark Elf | Eldritch horror theme |
| 3 | Warchief Orc | Orc | Tribal warlord theme |

**Implementation notes:**
- Stored as a `race_variant` column on `kingdoms`
- Cosmetic overrides applied client-side (building skin, unit names, banner color)
- No stat changes — purely visual + lore
- Unlock via one-time purchase or premium subscription tier

---

### 2.2 Rewarded Video Ads

Players watch a short video ad (15–30 sec) in exchange for an in-game reward. Opt-in only — never forced.

| Reward Type | Amount | Daily Limit | Notes |
|-------------|--------|-------------|-------|
| Turns | +3 turns | 3x/day | Most requested; quickest engagement |
| Gold | +500 gold | 2x/day | Scales with kingdom size in v2 |
| Resource boost | +25% production for 1 hour | 1x/day | Time-limited, no economy break |
| Speed-up | Complete 1 construction/research queue item | 1x/day | High perceived value |

**Ad provider options:**
- **Playwire** — Best for browser-based web games; strong fill rate
- **IronSource (Unity LevelPlay)** — Best mediation layer; highest CPM potential
- **AdColony** — High-quality video, good engagement rates

**Backend requirement:**
- Server-side reward callback (provider pings `/api/ads/reward` with a verification token)
- Prevents client-side spoofing
- Rate-limit enforced per player per day in DB

---

### 2.3 Google AdSense — Display Ads

Use existing AdSense account for non-intrusive display advertising on non-gameplay pages.

| Placement | Page | Ad Type |
|-----------|------|---------|
| Header banner | `/portal` landing page | Leaderboard (728x90) |
| Sidebar | Forum pages | Rectangle (300x250) |
| Between-session interstitial | Login screen / game loading | Full-screen optional |

**Notes:**
- AdSense is **not** suitable for rewarded video — use Playwire/IronSource for that
- Keep ads off the main game canvas (`/game`) — kills immersion
- AdSense auto-ads can be enabled on `/portal` with minimal dev work

---

### 2.4 Premium Subscription Tiers

Monthly recurring revenue. Tiered so each level adds value without breaking game balance.

| Tier | Price (est.) | Perks |
|------|-------------|-------|
| **Adventurer** | $2.99/mo | +1 turn regen rate (7→8 per 25 min), ad-free experience |
| **Champion** | $6.99/mo | All above + 15% faster construction, 1 extra build queue slot |
| **Warlord** | $12.99/mo | All above + early access to new races/content, exclusive cosmetic pack per season |

**Balance guardrails:**
- Turn regen cap: max +2 above base regardless of tier stacking
- Construction bonus: never exceeds 25% total
- No permanent resource bonuses — time-based boosts only

---

### 2.5 Battle Pass / Season Pass

30-day seasonal pass with tiered cosmetic rewards. Free track + paid track.

**Structure:**
- 20 tiers over 30 days (earnable via normal play)
- Free track: cosmetic fragments, lore entries, small resource boosts
- Paid track (~$4.99): exclusive building skins, banner frames, hero cosmetics, race variant unlock

**Season themes (ideas):**
- Season 1: Age of Fire (volcanic/forge aesthetic)
- Season 2: The Frozen War (ice/tundra)
- Season 3: Shadow Tide (void/eldritch)

---

### 2.6 One-Time Cosmetic Purchases

Permanent unlocks sold individually or in bundles.

| Item | Price (est.) | Description |
|------|-------------|-------------|
| Kingdom banner pack | $1.99 | 10 unique banner designs |
| Building theme pack | $3.99 | Full reskin of all buildings (one theme) |
| Hero portrait pack | $2.99 | 20 premium hero portraits |
| Race variant unlock | $4.99 | Unlock one premium race variant permanently |
| Cosmetic bundle | $9.99 | All themes + 2 race variants |

---

## 3. Implementation Priority

| Priority | Feature | Effort | Revenue Potential |
|----------|---------|--------|-------------------|
| P0 | AdSense on `/portal` | Low | Low (immediate) |
| P1 | Rewarded video ads (turns/gold) | Medium | Medium |
| P2 | Premium subscription tiers | Medium | High (recurring) |
| P3 | Race variant cosmetics | High | Medium |
| P4 | Battle pass system | High | High (seasonal) |
| P5 | One-time cosmetic store | Medium | Medium |

---

## 4. Technical Requirements

### Rewarded Ad Backend
- `POST /api/ads/reward` — verifies provider callback token, grants reward
- `GET /api/ads/status` — returns player's daily ad usage
- New DB table: `ad_rewards (player_id, reward_type, granted_at, provider_token)`

### Subscription System
- Payment processor: **Stripe** recommended
- New DB columns: `players.subscription_tier`, `players.subscription_expires_at`
- Middleware: `requireSubscription(tier)` for gated features

### Cosmetic System
- New DB columns: `kingdoms.race_variant`, `kingdoms.building_theme`, `kingdoms.banner_id`
- Client-side skin resolution: `resolveSkin(race, variant)` in game constants
- Admin panel: cosmetic assignment tools (already have admin panel infra)

### Analytics
- Track: ad views, completions, reward grants, subscription conversions
- Use existing game event system or add a lightweight `analytics_events` table

---

## 5. Open Questions

| # | Question | Decision needed by |
|---|----------|-------------------|
| Q1 | Stripe vs Paddle vs LemonSqueezy for payments? | Before sub tier work |
| Q2 | Playwire vs IronSource for rewarded video? | Before ad backend |
| Q3 | Should race variants have any minor stat difference (5-10%) or pure cosmetic? | Design decision |
| Q4 | Season pass duration — 30 days or aligned to game seasons (spring/summer/fall/winter)? | Design decision |
| Q5 | Free-to-play players: should they earn cosmetics via gameplay milestones? | Retention strategy |

---

*Document version: 1.0 — 2026-06-26*
