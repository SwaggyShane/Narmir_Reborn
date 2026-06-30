# Narmir Reborn API Documentation

All endpoints require authentication via JWT token (httpOnly cookie or `Authorization: Bearer <token>` header) unless otherwise noted. State-changing operations (POST/PUT/DELETE) require CSRF token validation via `X-CSRF-Token` header or `_csrf` form field.

## Base URL

- **Production:** `https://narmirreborn.com/api`
- **Development:** `http://localhost:3000/api`

---

## Authentication (`/auth`)

No auth required for register/login/logout.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/register` | Create new account |
| POST | `/auth/login` | Login with credentials, receive JWT |
| POST | `/auth/logout` | Logout and clear auth cookies |
| POST | `/auth/force-logout` | Force logout across all browsers |
| GET | `/auth/me` | Get authenticated user profile |

---

## Kingdom Profile (`/kingdom`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/kingdom/me` | Get full kingdom state (buildings, troops, resources, stats) |
| POST | `/kingdom/description` | Update kingdom description text |
| GET | `/kingdom/rankings` | Fetch leaderboard rankings (top 500 kingdoms) |
| GET | `/kingdom/alliance-rankings` | Fetch alliance standings and stats |

---

## Gameplay (`/kingdom`)

All require authentication. Core game operations.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/kingdom/turn` | Advance to next turn (consumes 1 turn) |
| GET | `/kingdom/chat/global` | Fetch global chat messages |
| GET | `/kingdom/news/list` | Fetch kingdom event news feed |
| DELETE | `/kingdom/news/clear` | Clear all news notifications |
| POST | `/kingdom/search` | Send rangers to search (scrap/loot discovery) |
| POST | `/kingdom/options` | Set tax rate and update kingdom name |
| GET | `/kingdom/season` | Get current season and time until next change |
| GET | `/kingdom/locations` | Get discovered kingdoms and map data |
| GET | `/kingdom/profile/:name` | Get public kingdom profile by name (no auth required) |
| GET | `/kingdom/world-map` | Fetch world map visualization |
| POST | `/kingdom/rebirth` | Prestige reset with bonuses |
| GET | `/kingdom/lore-and-achievements` | Fetch collected lore and achievement status |
| GET | `/kingdom/resource-nodes` | Get discovered resource node locations |
| POST | `/kingdom/scout-node` | Send scouts to resource node (costs turn) |
| GET | `/kingdom/resource-expeditions` | Get active resource expeditions |
| POST | `/kingdom/resource-upgrade` | Upgrade resource extractor building |
| GET | `/kingdom/inventory` | Fetch equipped items and equipment stockpile |
| GET | `/kingdom/attunements` | Get current fragment attunements by building |
| GET | `/kingdom/available-attunements` | List available fragments for attunement |
| POST | `/kingdom/attune-fragment` | Assign fragment to building (permanent) |
| POST | `/kingdom/remove-attunement` | Remove fragment from building |
| GET | `/kingdom/contributing-synergies` | Get active synergies and bonuses |
| GET | `/kingdom/synergy-status` | Fetch synergy progress (how many fragments placed) |
| GET | `/kingdom/synergy-cooldown` | Check synergy ability cooldown |
| POST | `/kingdom/activate-synergy-ability` | Trigger active synergy ability (has cooldown) |

---

## Building & Construction (`/kingdom`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/kingdom/build-queue` | Queue building orders (costs gold per building) |
| GET | `/kingdom/training-allocation` | Get unit training allocation |
| POST | `/kingdom/training-allocation` | Set training allocation (spellbook/school focus for mages) |
| POST | `/kingdom/build-allocation` | Set engineer allocation to building queues |
| POST | `/kingdom/resource-build-allocation` | Set engineer allocation to resource miners |
| POST | `/kingdom/school-allocation` | Set mage allocation to spellbook schools |
| POST | `/kingdom/library-allocation` | Set scribe allocation to library |
| POST | `/kingdom/shrine-allocation` | Set cleric allocation to shrine |
| POST | `/kingdom/mausoleum-allocation` | Set thrall allocation to mausoleum (vampire only) |
| POST | `/kingdom/smithy-allocation` | Set smithy focus (stub - not fully implemented) |
| POST | `/kingdom/build` | Build single structure immediately (costs engineers + resources) |
| POST | `/kingdom/demolish` | Demolish building for partial gold refund |
| POST | `/kingdom/cancel-building` | Cancel queued building (refund partial gold) |
| POST | `/kingdom/hire` | Recruit military and support units (costs gold/resources) |
| POST | `/kingdom/fire` | Dismiss units (return to population pool) |
| POST | `/kingdom/smithy/buy-hammers` | Purchase hammers from market |
| POST | `/kingdom/smithy/buy-scaffolding` | Purchase scaffolding from market |
| POST | `/kingdom/smithy/forge-tools` | Forge hammers/scaffolding at smithy (costs turn + resources) |
| POST | `/kingdom/tower-craft` | Craft spells at mage tower (consumes turn) |
| POST | `/kingdom/tower-cancel` | Cancel mage tower crafting queue |
| POST | `/kingdom/buy-mausoleum-upgrade` | Purchase vampire mausoleum upgrade |

---

## Military & Warfare (`/kingdom`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/kingdom/war-log` | Fetch battle history (last 100 combats) |
| GET | `/kingdom/war-log/:id` | Get detailed battle report by ID |
| POST | `/kingdom/attack` | Launch military attack on target (costs turn + troops) |
| POST | `/kingdom/spell` | Cast offensive/defensive spell (costs turn + spellbook) |
| POST | `/kingdom/covert` | Execute covert operation: spy/loot/assassinate/sabotage/raid (costs turn + troops) |
| GET | `/kingdom/defense/overview` | Get defense stats (walls, towers, troops, defense rating) |
| GET | `/kingdom/spy-reports` | Fetch spy operation reports |
| POST | `/kingdom/spy-reports/:id/share` | Toggle alliance visibility of spy report |
| GET | `/kingdom/spy-reports/alliance` | Get shared alliance spy intel |

---

## Research & Development (`/kingdom`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/kingdom/research-allocation` | Set research allocation (spellbook vs school spellbook) |
| POST | `/kingdom/research` | Research discipline (consumes turn) |
| POST | `/kingdom/select-school` | Choose primary magic school (Abjuration/Conjuration/etc) |
| GET | `/kingdom/studies/overview` | Get research progress and stats |

---

## Exploration (`/kingdom`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/kingdom/expedition/start` | Launch exploration expedition (costs turn + rangers) |
| GET | `/kingdom/expedition/list` | Get active and completed expeditions |
| POST | `/kingdom/expedition/acknowledge` | Mark expedition as read (deletes from list) |
| POST | `/kingdom/expedition/cancel` | Abort in-progress expedition (lose partial rewards) |
| DELETE | `/kingdom/expedition/clear-all` | Delete all completed expeditions from history |
| GET | `/kingdom/goals` | Fetch daily/weekly/monthly goals and progress |
| POST | `/kingdom/goals/claim` | Claim completed goal reward |

---

## Economy (`/kingdom`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/kingdom/market/prices` | Get current market prices for all resources |
| POST | `/kingdom/market/buy` | Purchase resources from market |
| POST | `/kingdom/market/sell` | Sell resources to market |
| GET | `/kingdom/economy/overview` | Get economy stats (production, consumption, tax income) |
| GET | `/kingdom/trade-routes/list` | Fetch active trade routes and partners |
| POST | `/kingdom/trade-routes/establish` | Create permanent trade route with player (costs gold) |
| POST | `/kingdom/trade-routes/cancel` | Cancel trade route with player |
| POST | `/kingdom/trade/clear-logs` | Delete completed trade history |
| POST | `/kingdom/economy/hire-mercs` | Hire temporary mercenary units (costs gold) |
| POST | `/kingdom/economy/dismiss-mercs` | End mercenary contract early |
| POST | `/kingdom/economy/bank-deposit` | Deposit gold to earn interest |
| POST | `/kingdom/economy/bank-withdraw` | Early withdraw from bank deposit (with penalty) |
| POST | `/kingdom/economy/upgrade` | Purchase building upgrade (costs gold/resources) |
| POST | `/kingdom/economy/trade/send` | Send trade offer to another player |
| GET | `/kingdom/economy/trade/list` | Fetch pending and sent trade offers |
| POST | `/kingdom/economy/trade/accept` | Accept incoming trade offer |
| POST | `/kingdom/economy/trade/decline` | Reject trade offer |

---

## Forum (`/forum`)

Public boards/topics readable without auth. Protected operations require authentication + CSRF.

**Public Endpoints:**

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|----------------|---------|
| GET | `/forum/index` | No | Get forum structure |
| GET | `/forum/boards` | No | List all forum boards |
| GET | `/forum/boards/:boardId/topics` | No | Get topics in board (paginated) |
| GET | `/forum/topics/:topicId/posts` | No | Get posts in topic (paginated) |

**Protected Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/forum/profile` | Get current user's forum avatar settings |
| PATCH | `/forum/profile` | Update forum profile (avatar mode/URL) |
| POST | `/forum/topics` | Create new forum topic |
| POST | `/forum/topics/:topicId/posts` | Create post / reply to topic |
| PATCH | `/forum/posts/:postId` | Edit own post (author only) |
| DELETE | `/forum/posts/:postId` | Soft-delete own post |
| DELETE | `/forum/topics/:topicId` | Delete topic (author only) |

**Admin Endpoints (requireAdmin):**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/forum/admin/moderators` | List forum moderators |
| GET | `/forum/admin/bans` | List forum bans |
| GET | `/forum/admin/logs` | View moderation audit log |
| POST | `/forum/admin/moderators` | Promote user to forum moderator |
| DELETE | `/forum/admin/moderators/:modId` | Demote forum moderator |
| POST | `/forum/moderation/ban-user` | Ban user from forum |
| DELETE | `/forum/moderation/bans/:banId` | Unban user from forum |
| POST | `/forum/moderation/hide-post` | Hide inappropriate post from public view |
| POST | `/forum/reports` | Report rule violation / post |
| GET | `/forum/moderation/queue` | Get pending moderation reports |
| PATCH | `/forum/moderation/reports/:reportId` | Resolve report (approve/dismiss) |

---

## Heroes (`/hero`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/hero/list` | Get all recruited heroes |
| GET | `/hero/classes` | Get hero classes and details |
| GET | `/hero/all-classes` | List all available hero classes |
| POST | `/hero/recruit` | Recruit new hero (costs gold) |

---

## Admin (`/admin`)

All require admin authentication. All state-changing ops require CSRF.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/kingdoms` | Get list of all kingdoms with stats |
| GET | `/admin/stats` | Fetch server-wide statistics |
| POST | `/admin/ban` | Ban player account |
| POST | `/admin/unban` | Unban player account |
| POST | `/admin/reset-turns` | Reset single kingdom to 400 turns |
| POST | `/admin/reset-turns-all` | Reset all kingdoms to 400 turns |
| POST | `/admin/reset-kingdom` | Wipe kingdom to starting state |
| POST | `/admin/reset-all-kingdoms` | Wipe all kingdoms |
| POST | `/admin/test-kingdoms/setup` | Create test accounts (one per race) |
| POST | `/admin/set-gold` | Adjust kingdom gold balance |
| POST | `/admin/set-building` | Modify building count directly |
| GET | `/admin/chat-mods` | List chat moderators |
| GET | `/admin/chat-bans` | List chat-banned players |
| POST | `/admin/chat-mod` | Promote player to chat moderator |
| POST | `/admin/chat-unban` | Unban from chat |
| GET | `/admin/kingdom-detail/:id` | Get detailed kingdom info (for debugging) |
| POST | `/admin/promote` | Promote player to admin |
| POST | `/admin/set-kingdom` | Modify kingdom stats directly |
| POST | `/admin/announce` | Broadcast server-wide announcement |
| GET | `/admin/ai-hiatus` | Get AI kingdom status |
| POST | `/admin/ai-hiatus` | Enable/disable AI kingdoms |
| GET | `/admin/ai/synopsis` | Get AI summary |
| POST | `/admin/ai/seed` | Seed AI with prompt |
| POST | `/admin/ai/reset` | Clear AI state |
| GET | `/admin/ai/presets` | List AI personality presets |
| POST | `/admin/ai/apply-preset` | Apply preset to AI kingdoms |
| DELETE | `/admin/kingdom/:id` | Permanently delete kingdom |
| GET | `/admin/config` | Get server configuration |
| POST | `/admin/config` | Update server configuration |
| POST | `/admin/flush-locations` | Clear location cache |
| POST | `/admin/flush-support-troops` | Clear support troop cache |
| GET | `/admin/events/log` | View event logs |
| GET | `/admin/events/list` | Get active server events |
| POST | `/admin/events/create` | Create server event |
| POST | `/admin/events/update` | Modify server event |
| POST | `/admin/events/delete` | Remove server event |
| GET | `/admin/suggestions` | View player suggestions |
| GET | `/admin/wishlist` | View feature requests |
| POST | `/admin/wishlist` | Add feature request |
| POST | `/admin/wishlist/:id/complete` | Mark feature as complete |
| GET | `/admin/lore` | Get world lore entries |
| POST | `/admin/lore` | Add lore entry |
| PUT | `/admin/lore/:id` | Modify lore entry |
| DELETE | `/admin/lore/:id` | Delete lore entry |
| GET | `/admin/sounds` | List available sound files |
| POST | `/admin/sounds/upload` | Upload new sound file |
| POST | `/admin/sounds/delete` | Delete sound file |
| GET | `/admin/fragments` | Get world fragment metadata |
| GET | `/admin/goals` | View goal definitions |
| POST | `/admin/goals/edit` | Modify goal rewards/targets |
| POST | `/admin/goals/add` | Add new goal type |
| POST | `/admin/goals/remove` | Remove goal type |
| GET | `/admin/security-audit` | Run security audit report |
| GET | `/admin/security-audit-full` | Full security audit (includes SQL injection scan) |
| POST | `/admin/repair-resource-allocations` | Fix corrupted allocations |
| POST | `/admin/repair-json-rows` | Repair malformed JSON in database |
| GET | `/admin/repair-json-rows/status` | Check JSON repair progress |
| GET | `/admin/audit-notifications/settings` | Get audit notification settings |
| POST | `/admin/audit-notifications/settings` | Update audit notification preferences |
| GET | `/admin/audit-notifications/recent` | Fetch recent audit notifications |
| GET | `/admin/audit-history` | View full audit log |
| GET | `/admin/security-audit/sql-injection` | SQL injection vulnerability scan |
| GET | `/admin/security-audit/sql-injection/status` | Check injection scan progress |

---

## Discord Integration (`/discord`)

All require authentication.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/discord/link-discord` | Link Discord account to kingdom |
| POST | `/discord/unlink-discord` | Unlink Discord account |
| GET | `/discord/link-status` | Check Discord linking status |
| POST | `/discord/verify-token` | Verify Discord bot token |
| POST | `/discord/admin/configure-channel` | Set Discord announcement channel |
| POST | `/discord/admin/toggle-channel` | Enable/disable channel notifications |
| GET | `/discord/admin/configs` | Get Discord integration config |
| GET | `/discord/admin/linked-users` | List Discord-linked players |

---

## Common Response Patterns

### Success Response
```json
{
  "ok": true,
  "data": { /* endpoint-specific data */ }
}
```

Or direct data response:
```json
{
  "rows": [ /* data */ ],
  "count": 42
}
```

### Error Response
```json
{
  "error": "Description of what went wrong",
  "code": "ERROR_CODE"
}
```

### Authentication Error
```json
{
  "error": "Not authenticated",
  "code": "AUTH_REQUIRED"
}
```

### Validation Error
```json
{
  "error": "Invalid input: field must be a positive integer",
  "status": 400
}
```

---

## Authentication Details

- **JWT Location:** `token` cookie (httpOnly, secure) OR `Authorization: Bearer <token>` header
- **CSRF Token:** Required for POST/PUT/DELETE; pass as `X-CSRF-Token` header or `_csrf` form field
- **Token Expiration:** Typically 7 days (configurable via environment)
- **Session Persistence:** Survives server restarts via persistent JWT

---

## Rate Limiting

API endpoints are rate-limited per IP and per user. See `docs/API_RATE_LIMITING.md` for detailed rate limit configuration and monitoring.

---

## WebSocket Events (Socket.io)

Real-time updates via Socket.io connection. Listen on client with `socket.on()`:

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `kingdom:update` | Server → Client | `{ kingdomId, updates }` | Kingdom state changed (resources, troops, etc) |
| `news:new` | Server → Client | `{ kingdomId, type, message }` | New news event for kingdom |
| `chat:message` | Both ways | `{ username, message, timestamp }` | Global chat message posted |
| `battle:result` | Server → Client | `{ attackerId, defenderId, outcome }` | Battle completed, results available |
| `turn:advanced` | Server → Client | `{ turnNumber, timestamp }` | Game turn incremented globally |
| `player:online` | Both ways | `{ username, status }` | Player login/logout |

---

## HTTP Status Codes & Error Codes

### Success Codes

| Code | Meaning | Example Scenario |
|------|---------|------------------|
| `200` | OK | Request succeeded, response body contains data |
| `201` | Created | Resource created successfully (rare; most use 200) |
| `204` | No Content | Request succeeded, no response body |

### Client Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `400` | Bad Request | Invalid input (wrong field format, missing required fields) |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Authenticated but insufficient permissions (e.g., player trying to delete another player's post) |
| `404` | Not Found | Resource doesn't exist (kingdom ID, post ID, etc.) |
| `422` | Unprocessable Entity | Validation failed (e.g., negative gold amount) |
| `429` | Too Many Requests | Rate limit exceeded; check `Retry-After` header |

### Server Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `500` | Internal Server Error | Unexpected error; contact support if persistent |
| `503` | Service Unavailable | Server is restarting or under maintenance |

---

## Common Error Response Codes

Errors are returned with specific error codes to help clients handle them programmatically:

| Error Code | HTTP Status | Meaning | Example |
|------------|-------------|---------|---------|
| `AUTH_REQUIRED` | 401 | No JWT token provided | Missing auth header/cookie |
| `INVALID_TOKEN` | 401 | JWT token is invalid or expired | Token malformed or tampered |
| `CSRF_FAILED` | 403 | CSRF token missing or invalid | POST without X-CSRF-Token header |
| `INSUFFICIENT_PERMISSIONS` | 403 | User doesn't have permission | Non-admin accessing /admin endpoint |
| `RESOURCE_NOT_FOUND` | 404 | Kingdom/post/item doesn't exist | Invalid ID in URL |
| `INVALID_INPUT` | 400 | Request body validation failed | Negative troop count, invalid enum |
| `INSUFFICIENT_RESOURCES` | 422 | Not enough resources for action | Buying troops without gold |
| `RATE_LIMITED` | 429 | Too many requests from this IP | Exceeded rate limit threshold |
| `ALREADY_EXISTS` | 409 | Resource already exists | Registering with existing email |
| `CONFLICT` | 409 | Action conflicts with game state | Attacking ally when peace treaty active |

---

## Request/Response Examples

### Authentication

#### POST /auth/register

**Request:**
```bash
curl -X POST https://narmirreborn.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "username": "Gandalf",
    "password": "SecurePassword123!",
    "kingdomName": "Gandalfs Realm",
    "race": "human"
  }'
```

**Success Response (201):**
```json
{
  "ok": true,
  "username": "Gandalf",
  "kingdomName": "Gandalfs Realm",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (400):**
```json
{
  "error": "Invalid input: password must be at least 8 characters",
  "code": "INVALID_INPUT",
  "status": 400
}
```

**Error Response (409):**
```json
{
  "error": "Email already registered",
  "code": "ALREADY_EXISTS",
  "status": 409
}
```

---

#### POST /auth/login

**Request:**
```bash
curl -X POST https://narmirreborn.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Gandalf",
    "password": "SecurePassword123!"
  }'
```

**Success Response (200):**
```json
{
  "ok": true,
  "username": "Gandalf",
  "isAdmin": false,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (401):**
```json
{
  "error": "Invalid username or password",
  "code": "AUTH_REQUIRED",
  "status": 401
}
```

**Rate Limited Response (429):**
```json
{
  "error": "Too many login attempts. Try again in 60 seconds.",
  "code": "RATE_LIMITED",
  "status": 429,
  "retryAfter": 60
}
```

---

### Gameplay

#### GET /kingdom/me

**Request:**
```bash
curl https://narmirreborn.com/api/kingdom/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Success Response (200):**
```json
{
  "id": 123,
  "player_id": 456,
  "name": "Gandalf's Realm",
  "race": "human",
  "gold": 150000,
  "food": 95000,
  "population": 25000,
  "land": 1200,
  "turn": 150,
  "turns_stored": 120,
  "username": "Gandalf",
  "score": 18420,
  "defense_rating": 9320,
  "built_land": 840
}
```

---

#### POST /kingdom/turn

**Request:**
```bash
curl -X POST https://narmirreborn.com/api/kingdom/turn \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "X-CSRF-Token: csrf-token-value" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Success Response (200):**
```json
{
  "ok": true,
  "updates": {
    "gold": 155000,
    "food": 97000,
    "turn": 151,
    "turns_stored": 119
  },
  "events": [
    {
      "type": "system",
      "message": "Your barracks completed 50 swordsmen"
    },
    {
      "type": "system",
      "message": "Your rangers discovered an iron ore deposit"
    }
  ],
  "turns_stored": 119
}
```

**Error Response (422):**
```json
{
  "error": "Not enough turn limit remaining",
  "code": "INSUFFICIENT_RESOURCES",
  "status": 422
}
```

---

#### POST /kingdom/attack

**Request:**
```bash
curl -X POST https://narmirreborn.com/api/kingdom/attack \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "X-CSRF-Token: csrf-token-value" \
  -H "Content-Type: application/json" \
  -d '{
    "targetKingdomId": "enemy-kingdom-789",
    "troops": {
      "swordsmen": 500,
      "cavalry": 200,
      "archers": 300
    }
  }'
```

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "battleId": "battle-uuid-123",
    "attacker": {
      "kingdomId": "kingdom-123",
      "kingdomName": "Gandalf's Realm",
      "troopsDeployed": 1000,
      "troopsKilled": 150,
      "troopsReturning": 850
    },
    "defender": {
      "kingdomId": "enemy-kingdom-789",
      "kingdomName": "Sauron's Dark Tower",
      "troopsKilled": 400,
      "troopsLost": 400
    },
    "outcome": "ATTACKER_WINS",
    "loot": {
      "gold": 5000,
      "resources": 2000
    },
    "duration": 45
  }
}
```

---

### Forum

#### GET /forum/boards

**Request:**
```bash
curl https://narmirreborn.com/api/forum/boards
```

**Success Response (200):**
```json
[
  {
    "id": "general",
    "name": "General Discussion",
    "description": "Off-topic discussion and announcements",
    "order_index": 1,
    "topicCount": 1245,
    "postCount": 8934
  },
  {
    "id": "strategies",
    "name": "Strategies & Tips",
    "description": "Share your kingdom strategies",
    "order_index": 2,
    "topicCount": 432,
    "postCount": 3201
  }
]
```

---

#### POST /forum/topics

**Request:**
```bash
curl -X POST https://narmirreborn.com/api/forum/topics \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "X-CSRF-Token: csrf-token-value" \
  -H "Content-Type: application/json" \
  -d '{
    "boardId": "strategies",
    "title": "Early Game Economy Guide",
    "content": "Here are tips for managing early game resources..."
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "topicId": 456,
  "message": "Topic created successfully"
}
```

**Error Response (403):**
```json
{
  "error": "User is banned from forum",
  "code": "INSUFFICIENT_PERMISSIONS",
  "status": 403
}
```

---

### Market

#### GET /kingdom/market/prices

**Request:**
```bash
curl https://narmirreborn.com/api/kingdom/market/prices \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Success Response (200):**
```json
[
  {
    "id": "wood",
    "base_price": 10,
    "current_price": 12.5,
    "updated_at": "2026-06-29T14:32:15Z"
  },
  {
    "id": "stone",
    "base_price": 15,
    "current_price": 14.2,
    "updated_at": "2026-06-29T14:32:15Z"
  }
]
```

---

#### POST /kingdom/market/buy

**Request:**
```bash
curl -X POST https://narmirreborn.com/api/kingdom/market/buy \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "X-CSRF-Token: csrf-token-value" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "wood",
    "amount": 5000
  }'
```

**Success Response (200):**
```json
{
  "ok": true,
  "bought": 5000,
  "cost": 62500,
  "message": "Bought 5,000 wood from the market for 62,500 GC.",
  "updates": {
    "gold": 87500,
    "wood": 50000
  }
}
```

**Error Response (422):**
```json
{
  "error": "Insufficient gold: need 62500, have 40000",
  "code": "INSUFFICIENT_RESOURCES",
  "status": 422
}
```

---

## Rate Limiting Details

### Rate Limit Headers

All responses include rate limit information in headers:

```
X-RateLimit-Limit: 300           # Requests allowed per window
X-RateLimit-Remaining: 287       # Requests remaining before limit
X-RateLimit-Reset: 1625000000    # Unix timestamp when counter resets
```

### When Rate Limited (429)

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1625000045

{
  "error": "Rate limit exceeded: 300 requests per 60 seconds",
  "code": "RATE_LIMITED",
  "status": 429,
  "retryAfter": 45
}
```

**Action:** Wait `Retry-After` seconds before retrying.

### Rate Limit Categories

| Category | Limit | Applies To |
|----------|-------|-----------|
| **Auth** | 10/min (prod) | /auth/login, /auth/register |
| **Gameplay** | 300/min | /kingdom/turn, /kingdom/attack, /kingdom/spell |
| **Admin** | 30/min (prod) | /admin/* endpoints |
| **General** | 500/min | Forum, market, most other endpoints |

See `docs/API_RATE_LIMITING.md` for detailed configuration.

---

## Deprecated Endpoints

None currently. All endpoints listed above are active and functional.

---

**Last Updated:** 2026-06-29  
**API Version:** Pre-beta (Subject to change before v1.0)  
**Scope:** Comprehensive — covers all 150+ endpoints with examples and error codes
