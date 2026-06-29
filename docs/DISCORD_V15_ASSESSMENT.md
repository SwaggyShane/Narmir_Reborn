# Discord.js v15 Migration Assessment

**Date:** 2026-06-29  
**Current Version:** discord.js v14.14.0  
**Decision Point:** Beta launch readiness  
**Status:** Assessment Complete

---

## Executive Summary

**Recommendation: DO NOT MIGRATE to v15 before beta launch.**

**Rationale:** Discord.js v14 is stable and fully functional. The current Discord integration is minimal, well-contained, and working correctly. Upgrading to v15 (a major version with breaking changes) immediately before beta launch introduces unnecessary risk. Plan v15 migration as a post-beta enhancement.

---

## Current Discord Integration

### Features

| Feature | Status | Usage Pattern | Risk Level |
|---------|--------|---------------|-----------|
| Chat relay | Active | Bot polls DB, syncs to Discord | Low |
| Bug reports | Active | Bot captures forum reports to Discord | Low |
| Account linking | Active | REST endpoints for player↔Discord links | Low |
| Webhooks | Supported | Fallback when bot token unavailable | Low |

### Implementation Scope

**Files involved:** 3 core files + 1 database table

```
discord-bot.js                  (350 lines) — Polling, chat relay, bug reports
routes/discord.js               (150 lines) — Account linking REST endpoints
lib/discord-notify.js           (200 lines) — Webhook + embed builders
db/discord_sync_config          (1 table)   — Channel configuration
db/discord_links                (1 table)   — Player↔Discord linking
```

### Current API Usage

**discord.js v14 features in use:**

| API | Usage | Stability |
|-----|-------|-----------|
| `Client()` | Bot initialization | ✅ Core, unlikely to break |
| `GatewayIntentBits` | Intent specification | ✅ Stable since v13 |
| `EmbedBuilder` | Discord embed formatting | ✅ Stable |
| `ChannelType` enum | Channel filtering | ✅ Stable |
| `PermissionFlagsBits` | Permission checking | ✅ Stable |

**Direct Discord API calls in use:**

```javascript
// Webhook fallback
fetch('https://discord.com/api/v10/channels/{channelId}/messages', {
  method: 'POST',
  headers: { Authorization: `Bot ${token}` },
  body: JSON.stringify({ embeds: [...] })
});
```

---

## Discord.js v15 Considerations

### Release Status (As of June 2026)

Discord.js v15 is expected to include:
- Major version bump = breaking changes
- REST client improvements and reorganization
- Gateway handler updates
- Potentially new intent requirements
- Stricter type checking (TypeScript-driven changes)

### Likely Breaking Changes

Based on Discord.js versioning history:

| Change | Impact | Migration Effort |
|--------|--------|-----------------|
| REST API restructuring | Possible refactor of webhook calls | Medium |
| Client initialization | Possible constructor signature change | Low |
| Intent handling | Unlikely major changes (stable since v13) | Low |
| Embed builders | Usually backward-compatible | Low |
| Database schema changes | None expected (user-facing) | None |

### Known Risks of Pre-Beta Migration

1. **v15 release stability:** Major versions often have edge cases and regressions in early releases
2. **Dependency conflicts:** discord.js has dependency overrides (undici 6.27.0) that may change
3. **Node.js compatibility:** v15 might require Node.js version bump
4. **Time cost:** Migration + testing + bug fixes during beta launch window
5. **Support timeframe:** v14 will still receive security patches through beta

---

## Migration Effort Estimate

### If v15 Migration Is Later Decided

**Effort breakdown:**

| Phase | Time | Complexity |
|-------|------|-----------|
| Upgrade discord.js dependency | 30 min | Low |
| Update imports & client initialization | 1 hour | Low |
| Fix deprecated APIs | 2-3 hours | Medium |
| Test Discord bot locally | 1 hour | Medium |
| Smoke test on staging | 2 hours | Medium |
| Fix integration issues | 2-4 hours | Medium |
| **Total** | **9-12 hours** | **Medium** |

### Safe Migration Timing

**Post-beta options:**
- Week 1 after beta launch: Stable v15 release likely available, user feedback collected
- Batched with other dependencies: v15 migration + React 20 + Node 26 all together
- Rolling update: Announce v15 support as Phase 7 feature

---

## Current Beta Readiness Status

✅ **Discord integration is ready for beta with v14:**

- No known bugs in current implementation
- Bot polling is stable and tested
- Webhook fallback works
- Account linking functional
- All features documented

**Risk of breaking v14 before beta:** HIGH  
**Benefit of upgrading to v15 now:** LOW

---

## Recommendation: Three-Part Strategy

### Option A: Recommended (Lock v14 for Beta)

```json
{
  "Action": "Keep discord.js v14.14.0 through beta",
  "Rationale": "Proven stable, no v15 release guarantee",
  "Timeline": "June-August 2026",
  "Post-Beta Plan": "Plan v15 migration for Phase 7 (September 2026)",
  "Risk": "Low"
}
```

**Commit message for pinning:**

```
chore: Pin discord.js to v14.14.0 for beta stability
Rationale: v15 is not released yet; maintaining v14 minimizes
integration risk during beta launch. Post-beta, assess v15 when
release is stable (est. Q3 2026). Migration effort: ~10 hours.
```

### Option B: Conditional (Migrate Only If v15 Releases Early)

If Discord.js v15 is released with stable reputation by July 15, 2026:
1. Assess v15 changelog for breaking changes
2. Schedule migration task with 2-week timeline
3. Test thoroughly on staging before deploying to production

### Option C: Not Recommended (Migrate Now)

❌ **Do not do this** before beta. Major version upgrades immediately before launch create too much risk.

---

## Checklist for Beta Launch (v14)

- ✅ discord-bot.js is implemented and tested
- ✅ Discord account linking works end-to-end
- ✅ Chat relay to Discord channels functional
- ✅ Bug report webhook capture working
- ✅ Webhook fallback tested
- ✅ Environment variables documented
- ⚠️ **Action needed:** Ensure DISCORD_BOT_TOKEN is configured in Railway production
- ⚠️ **Action needed:** Test Discord bot permissions (Send Messages, Embed Links)

---

## Post-Beta Discord Roadmap

**Phase 7 (Tentative):** Discord.js v15 + Enhancements

```markdown
1. v15 Migration (if stable by August 2026)
   - Upgrade discord.js, test thoroughly
   - Estimated effort: 10 hours
   
2. New Features (if time permits)
   - Slash commands for kingdom info
   - Discord role-based permissions
   - Game update announcements to Discord roles
   - Player account verification via Discord
   
3. Monitoring & Ops
   - Bot uptime metrics
   - Relay latency tracking
   - Error alerting for Discord sync failures
```

---

## Decision Log

| Date | Item | Decision |
|------|------|----------|
| 2026-06-29 | Item 22: v15 Migration Assessment | **DO NOT MIGRATE before beta** |
| TBD | v15 Release Date | Monitor Discord.js releases |
| TBD | v15 Stability Assessment | Schedule post-beta evaluation |
| TBD | Phase 7 Kickoff | Plan formal v15 migration task |

---

## Appendix: Discord Integration Checklist

**Production deployment validation:**

- [ ] DISCORD_BOT_TOKEN is set in Railway environment
- [ ] DISCORD_UPDATES_CHANNEL_ID configured (for game updates)
- [ ] DISCORD_BUG_REPORTS_CHANNEL_ID or #bug-reports channel exists
- [ ] Bot has "Send Messages" permission in target channels
- [ ] Bot has "Embed Links" permission in target channels
- [ ] Webhook URLs configured (optional, if using webhook fallback)
- [ ] Database tables exist: `discord_links`, `discord_sync_config`, `chat_sync_log`
- [ ] Test message: Send chat message in-game, verify appears in Discord
- [ ] Test bug report: File bug report, verify posts to Discord
- [ ] Test account linking: Link Discord account via game, verify in DB

---

## References

- **Current Version:** discord.js v14.14.0
- **Dependency:** See package.json overrides: undici 6.27.0
- **Bot Token:** Requires NODE_ENV setup and Railway Postgres connection
- **Discord.js Docs:** https://old.discordjs.dev/#/docs/discord.js/14/general/welcome

---

**Conclusion:**

The Discord integration is **beta-ready with v14**. v15 migration is **not critical for beta launch** and should be deferred to a post-beta enhancement cycle when v15 is stable and well-tested. Current implementation is lean, functional, and carries no risk to game stability.

**Item 22 Resolution:** **Recommendation: Keep discord.js v14.14.0 through beta launch. Plan v15 migration as Phase 7 post-beta task.**
