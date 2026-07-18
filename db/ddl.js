'use strict';

/**
 * Database DDL (Data Definition Language) definitions.
 * Extracted from initDb in schema.js to reduce bloat.
 * All core table creation and indexes live here.
 *
 * Canonical regions table uses natural key "name" (TEXT PRIMARY KEY) to match
 * all application queries (game/world.js, engine.js, routes, init-data).
 * The legacy region_locations + numeric-id regions variant was unused (real
 * locations live in world_locations using region_name); removed to prevent
 * FK reference errors on non-existent "id" column.
 */

const coreSchema = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS players (
      id          SERIAL PRIMARY KEY,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      email       TEXT    UNIQUE,
      is_admin    INTEGER NOT NULL DEFAULT 0,
      is_banned   INTEGER NOT NULL DEFAULT 0,
      is_ai       INTEGER NOT NULL DEFAULT 0,
      ban_reason  TEXT,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS kingdoms (
      id          SERIAL PRIMARY KEY,
      player_id   INTEGER NOT NULL UNIQUE REFERENCES players(id),
      name        TEXT    NOT NULL,
      race        TEXT    NOT NULL DEFAULT 'human',
      gender      TEXT    NOT NULL DEFAULT 'male',
      gold        BIGINT NOT NULL DEFAULT 10000,
      land        INTEGER NOT NULL DEFAULT 500,
      population  INTEGER NOT NULL DEFAULT 50000,
      happiness   INTEGER NOT NULL DEFAULT 50,
      last_attack_turn INTEGER NOT NULL DEFAULT 0,
      rebellion_cooldown INTEGER NOT NULL DEFAULT 0,
      tax         INTEGER NOT NULL DEFAULT 42,
      mana        INTEGER NOT NULL DEFAULT 5000,
      food        INTEGER NOT NULL DEFAULT 0,
      turn        INTEGER NOT NULL DEFAULT 0,
      last_turn_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      turns_stored INTEGER NOT NULL DEFAULT 400,
      res_economy       INTEGER NOT NULL DEFAULT 100,
      res_weapons       INTEGER NOT NULL DEFAULT 100,
      res_armor         INTEGER NOT NULL DEFAULT 100,
      res_military      INTEGER NOT NULL DEFAULT 100,
      res_spellbook     INTEGER NOT NULL DEFAULT 0,
      res_attack_magic  INTEGER NOT NULL DEFAULT 100,
      res_defense_magic INTEGER NOT NULL DEFAULT 100,
      res_entertainment INTEGER NOT NULL DEFAULT 100,
      res_construction  INTEGER NOT NULL DEFAULT 100,
      res_war_machines  INTEGER NOT NULL DEFAULT 100,
      bld_farms         INTEGER NOT NULL DEFAULT 200,
      bld_granaries     INTEGER NOT NULL DEFAULT 0,
      bld_barracks      INTEGER NOT NULL DEFAULT 0,
      bld_outposts      INTEGER NOT NULL DEFAULT 0,
      bld_guard_towers  INTEGER NOT NULL DEFAULT 0,
      bld_schools       INTEGER NOT NULL DEFAULT 0,
      bld_armories      INTEGER NOT NULL DEFAULT 0,
      bld_vaults        INTEGER NOT NULL DEFAULT 0,
      bld_smithies      INTEGER NOT NULL DEFAULT 0,
      bld_markets       INTEGER NOT NULL DEFAULT 0,
      bld_mage_towers    INTEGER NOT NULL DEFAULT 0,
      bld_shrines       INTEGER NOT NULL DEFAULT 0,
      mage_tower_allocation TEXT NOT NULL DEFAULT '{}',
      shrine_allocation TEXT NOT NULL DEFAULT '{}',
      bld_training      INTEGER NOT NULL DEFAULT 0,
      bld_castles       INTEGER NOT NULL DEFAULT 0,
      bld_housing       INTEGER NOT NULL DEFAULT 100,
      fighters    INTEGER NOT NULL DEFAULT 0,
      rangers     INTEGER NOT NULL DEFAULT 0,
      clerics     INTEGER NOT NULL DEFAULT 0,
      mages       INTEGER NOT NULL DEFAULT 0,
      thieves     INTEGER NOT NULL DEFAULT 0,
      ninjas      INTEGER NOT NULL DEFAULT 0,
      researchers INTEGER NOT NULL DEFAULT 0,
      engineers   INTEGER NOT NULL DEFAULT 0,
      engineer_level INTEGER NOT NULL DEFAULT 1,
      engineer_xp    INTEGER NOT NULL DEFAULT 0,
      war_machines     INTEGER NOT NULL DEFAULT 0,
      ballistae        INTEGER NOT NULL DEFAULT 0,
      weapons_stockpile INTEGER NOT NULL DEFAULT 0,
      armor_stockpile   INTEGER NOT NULL DEFAULT 0,
      ladders          INTEGER NOT NULL DEFAULT 0,
      research_allocation TEXT NOT NULL DEFAULT '{}',
      build_queue       TEXT NOT NULL DEFAULT '{}',
      build_progress    TEXT NOT NULL DEFAULT '{}',
      build_allocation  TEXT NOT NULL DEFAULT '{}',
      resource_build_allocation TEXT NOT NULL DEFAULT '{}',
      tools_hammers     INTEGER NOT NULL DEFAULT 0,
      tools_scaffolding INTEGER NOT NULL DEFAULT 0,
      tools_blueprints  INTEGER NOT NULL DEFAULT 0,
      scaffolding_stored INTEGER NOT NULL DEFAULT 0,
      hammers_stored     INTEGER NOT NULL DEFAULT 0,
      xp                REAL NOT NULL DEFAULT 0,
      xp_sources        TEXT NOT NULL DEFAULT '{"turn":0,"gold":0,"combat_win":0,"combat_loss":0,"research":0,"construction":0,"exploration":0,"spell_cast":0,"covert_op":0}',
      level             INTEGER NOT NULL DEFAULT 1,
      troop_levels      TEXT NOT NULL DEFAULT '{}',
      equipment_levels  TEXT NOT NULL DEFAULT '{}',
      training_allocation TEXT NOT NULL DEFAULT '{}',
      scribes     INTEGER NOT NULL DEFAULT 0,
      bld_libraries     INTEGER NOT NULL DEFAULT 0,
      library_allocation TEXT NOT NULL DEFAULT '{}',
      wounded_troops TEXT NOT NULL DEFAULT '{}',
      library_progress   TEXT NOT NULL DEFAULT '{}',
      tower_progress     TEXT NOT NULL DEFAULT '{}',
      scrolls           TEXT NOT NULL DEFAULT '{}',
      maps              INTEGER NOT NULL DEFAULT 0,
      blueprints_stored INTEGER NOT NULL DEFAULT 0,
      active_effects    TEXT NOT NULL DEFAULT '{}',
      coal              INTEGER NOT NULL DEFAULT 0,
      steel             INTEGER NOT NULL DEFAULT 0,
      -- Forge system (FORGE_SYSTEM.md §15.4 handshake — A1 schema)
      -- Reuses pre-existing coal/steel columns above (no coal_stored/steel_stored dupes)
      toolwright_yard   INTEGER NOT NULL DEFAULT 0,
      engineers_lodge   INTEGER NOT NULL DEFAULT 0,
      forge             INTEGER NOT NULL DEFAULT 0,
      tempered_steel    INTEGER NOT NULL DEFAULT 0,
      lava_stored       INTEGER NOT NULL DEFAULT 0,
      steel_weapons     INTEGER NOT NULL DEFAULT 0,
      steel_armor       INTEGER NOT NULL DEFAULT 0,
      tempered_weapons  INTEGER NOT NULL DEFAULT 0,
      tempered_armor    INTEGER NOT NULL DEFAULT 0,
      flux_barges       TEXT NOT NULL DEFAULT '[]',
      charcoal_wood_allocation INTEGER NOT NULL DEFAULT 0,
      school_of_magic   TEXT,
      school_spellbook  INTEGER NOT NULL DEFAULT 0,
      x                 INTEGER NOT NULL DEFAULT 0,
      y                 INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS alliances (
      id          SERIAL PRIMARY KEY,
      name        TEXT    NOT NULL UNIQUE,
      leader_id   INTEGER NOT NULL REFERENCES kingdoms(id),
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    -- regions: canonical (name PK). References alliances which is now defined.
    -- All game code uses name as key (SELECT ... WHERE name= , ON CONFLICT (name)).
    CREATE TABLE IF NOT EXISTS regions (
      name              TEXT PRIMARY KEY,
      owner_alliance_id INTEGER REFERENCES alliances(id),
      contest_alliance_id INTEGER REFERENCES alliances(id),
      contest_progress  INTEGER NOT NULL DEFAULT 0,
      bonus_type        TEXT,
      lore              TEXT,
      created_at        INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at        INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS alliance_members (
      alliance_id INTEGER NOT NULL REFERENCES alliances(id),
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      pledge      INTEGER NOT NULL DEFAULT 3,
      joined_at   INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      PRIMARY KEY (alliance_id, kingdom_id)
    );

    CREATE TABLE IF NOT EXISTS news (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      type        TEXT    NOT NULL,
      title       TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS war_log (
      id              SERIAL PRIMARY KEY,
      attacker_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      defender_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      attacker_name   TEXT,
      defender_name   TEXT,
      result          TEXT    NOT NULL,
      gold_stolen     INTEGER NOT NULL DEFAULT 0,
      land_gained     INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_war_log_time ON war_log(created_at DESC);

    CREATE TABLE IF NOT EXISTS expeditions (
      id              SERIAL PRIMARY KEY,
      kingdom_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      target_id       INTEGER REFERENCES kingdoms(id),
      type            TEXT    NOT NULL,
      turns_left      INTEGER NOT NULL,
      rewards         TEXT,
      rewards_claimed INTEGER NOT NULL DEFAULT 0,
      seen            INTEGER NOT NULL DEFAULT 0,
      extra_data      TEXT    NOT NULL DEFAULT '{}',
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_exp_kingdom ON expeditions(kingdom_id);

    CREATE TABLE IF NOT EXISTS combat_log (
      id            SERIAL PRIMARY KEY,
      attacker_id   INTEGER NOT NULL REFERENCES kingdoms(id),
      defender_id   INTEGER NOT NULL REFERENCES kingdoms(id),
      attacker_name TEXT,
      defender_name TEXT,
      result        TEXT    NOT NULL,
      details       TEXT,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER REFERENCES kingdoms(id),
      player_id   INTEGER NOT NULL DEFAULT 0,
      username    TEXT NOT NULL DEFAULT '',
      room        TEXT    NOT NULL DEFAULT 'global',
      message     TEXT NOT NULL,
      deleted     INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room, created_at);

    CREATE TABLE IF NOT EXISTS server_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS heroes (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      name        TEXT    NOT NULL,
      class       TEXT    NOT NULL,
      level       INTEGER NOT NULL DEFAULT 1,
      xp          INTEGER NOT NULL DEFAULT 0,
      abilities   TEXT    NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    DROP INDEX IF EXISTS idx_heroes_kingdom;
    CREATE INDEX IF NOT EXISTS idx_heroes_kingdom ON heroes(kingdom_id);

    -- world_locations (actual used table for dungeons/mountains)
    CREATE TABLE IF NOT EXISTS world_locations (
      id                       SERIAL PRIMARY KEY,
      type                     VARCHAR(20) NOT NULL,
      region_name              VARCHAR(50) NOT NULL,
      x                        NUMERIC NOT NULL,
      y                        NUMERIC NOT NULL,
      discovered_by_kingdom_ids INTEGER[] DEFAULT '{}',
      created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, region_name)
    );
    CREATE INDEX IF NOT EXISTS idx_world_locations_region ON world_locations(region_name);
    CREATE INDEX IF NOT EXISTS idx_world_locations_type ON world_locations(type);

    CREATE TABLE IF NOT EXISTS spy_reports (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      target_id INTEGER NOT NULL REFERENCES kingdoms(id),
      report TEXT NOT NULL,
      shared_to_alliance INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_spy_reports_kingdom ON spy_reports(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_spy_reports_target ON spy_reports(target_id);
    CREATE INDEX IF NOT EXISTS idx_spy_reports_created ON spy_reports(created_at DESC);

    -- Additional tables carved from schema.js initDb bloat
    CREATE TABLE IF NOT EXISTS mercenaries (
      id              SERIAL PRIMARY KEY,
      kingdom_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      unit_type       TEXT    NOT NULL,
      level           INTEGER NOT NULL,
      count           INTEGER NOT NULL,
      tier            TEXT    NOT NULL,
      hired_at_turn   INTEGER NOT NULL DEFAULT 0,
      duration_turns  INTEGER NOT NULL DEFAULT 20,
      upkeep_per_turn INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_mercs_kingdom ON mercenaries(kingdom_id);

    CREATE TABLE IF NOT EXISTS market_prices (
      id            TEXT PRIMARY KEY,
      current_price REAL NOT NULL,
      base_price    REAL NOT NULL,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      key         TEXT    NOT NULL UNIQUE,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL,
      season      TEXT    NOT NULL DEFAULT 'all',
      effect_type TEXT    NOT NULL DEFAULT 'happiness',
      effect_value REAL   NOT NULL DEFAULT 5,
      effect_duration INTEGER NOT NULL DEFAULT 1,
      race_only   TEXT    DEFAULT NULL,
      is_positive INTEGER NOT NULL DEFAULT 1,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS event_log (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      kingdom_name TEXT   NOT NULL,
      event_key   TEXT    NOT NULL,
      event_name  TEXT    NOT NULL,
      season      TEXT    NOT NULL,
      fired_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_event_log_fired ON event_log(fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_event_log_kingdom ON event_log(kingdom_id);

    CREATE TABLE IF NOT EXISTS synergy_cooldowns (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      synergy_id TEXT NOT NULL,
      cooldown_until INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      UNIQUE(kingdom_id, synergy_id)
    );
    CREATE INDEX IF NOT EXISTS idx_synergy_cooldowns_kingdom ON synergy_cooldowns(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_synergy_cooldowns_until ON synergy_cooldowns(cooldown_until);

    CREATE TABLE IF NOT EXISTS audit_schedules (
      id            SERIAL PRIMARY KEY,
      created_by    INTEGER NOT NULL REFERENCES players(id),
      frequency     TEXT NOT NULL DEFAULT 'weekly',
      is_enabled    INTEGER NOT NULL DEFAULT 1,
      next_run_at   INTEGER,
      last_run_at   INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS audit_history (
      id            SERIAL PRIMARY KEY,
      schedule_id   INTEGER REFERENCES audit_schedules(id),
      run_at        INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'success',
      findings_count INTEGER NOT NULL DEFAULT 0,
      findings      TEXT,
      error_message TEXT,
      duration_ms   INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS audit_notification_settings (
      id SERIAL PRIMARY KEY,
      notify_on_new_issues BOOLEAN DEFAULT TRUE,
      min_severity TEXT DEFAULT 'MEDIUM',
      discord_channel_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Trade / messaging / forum (large block extracted from schema.js bloat)
    CREATE TABLE IF NOT EXISTS trade_routes (
      id              SERIAL PRIMARY KEY,
      kingdom_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      partner_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      distance        INTEGER NOT NULL DEFAULT 0,
      stability       INTEGER NOT NULL DEFAULT 100,
      efficiency      REAL    NOT NULL DEFAULT 1.0,
      last_raid_at    INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_trade_routes_k ON trade_routes(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_trade_routes_p ON trade_routes(partner_id);
    CREATE INDEX IF NOT EXISTS idx_trade_routes_composite ON trade_routes(kingdom_id, partner_id);

    CREATE TABLE IF NOT EXISTS messages (
      id                SERIAL PRIMARY KEY,
      sender_id         INTEGER NOT NULL REFERENCES players(id),
      recipient_id      INTEGER NOT NULL REFERENCES players(id),
      content           TEXT NOT NULL,
      is_read           INTEGER NOT NULL DEFAULT 0,
      created_at        INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);

    CREATE TABLE IF NOT EXISTS forum_boards (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS forum_topics (
      id            SERIAL PRIMARY KEY,
      board_id      INTEGER NOT NULL REFERENCES forum_boards(id),
      player_id     INTEGER NOT NULL REFERENCES players(id),
      title         TEXT NOT NULL,
      content       TEXT NOT NULL,
      post_count    INTEGER NOT NULL DEFAULT 1,
      last_post_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      is_pinned     INTEGER NOT NULL DEFAULT 0,
      is_locked     INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS forum_posts (
      id            SERIAL PRIMARY KEY,
      topic_id      INTEGER NOT NULL REFERENCES forum_topics(id),
      player_id     INTEGER NOT NULL REFERENCES players(id),
      content       TEXT NOT NULL,
      is_deleted    INTEGER NOT NULL DEFAULT 0,
      deleted_at    INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS forum_moderators (
      id            SERIAL PRIMARY KEY,
      player_id     INTEGER NOT NULL REFERENCES players(id),
      board_id      INTEGER NOT NULL REFERENCES forum_boards(id),
      assigned_by   INTEGER NOT NULL REFERENCES players(id),
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      UNIQUE(player_id, board_id)
    );
    CREATE TABLE IF NOT EXISTS forum_bans (
      id            SERIAL PRIMARY KEY,
      player_id     INTEGER NOT NULL REFERENCES players(id),
      board_id      INTEGER REFERENCES forum_boards(id),
      ban_type      TEXT NOT NULL,
      reason        TEXT,
      expires_at    INTEGER,
      banned_by     INTEGER NOT NULL REFERENCES players(id),
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS forum_reports (
      id            SERIAL PRIMARY KEY,
      post_id       INTEGER NOT NULL REFERENCES forum_posts(id),
      reporter_id   INTEGER NOT NULL REFERENCES players(id),
      status        TEXT NOT NULL DEFAULT 'open',
      reviewed_by   INTEGER REFERENCES players(id),
      action_taken  TEXT,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      reviewed_at   INTEGER
    );
    CREATE TABLE IF NOT EXISTS forum_moderation_log (
      id            SERIAL PRIMARY KEY,
      moderator_id  INTEGER NOT NULL REFERENCES players(id),
      action        TEXT NOT NULL,
      target_type   TEXT NOT NULL,
      target_id     INTEGER NOT NULL,
      reason        TEXT,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS forum_profiles (
      player_id     INTEGER PRIMARY KEY REFERENCES players(id),
      avatar_mode   TEXT NOT NULL DEFAULT 'initials',
      avatar_url    TEXT,
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE INDEX IF NOT EXISTS idx_forum_boards_active ON forum_boards(is_active, order_index);
    CREATE INDEX IF NOT EXISTS idx_forum_topics_board ON forum_topics(board_id);
    CREATE INDEX IF NOT EXISTS idx_forum_topics_player ON forum_topics(player_id);
    CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON forum_posts(topic_id);
    CREATE INDEX IF NOT EXISTS idx_forum_posts_player ON forum_posts(player_id);
    CREATE INDEX IF NOT EXISTS idx_forum_moderators_player ON forum_moderators(player_id);
    CREATE INDEX IF NOT EXISTS idx_forum_moderators_board ON forum_moderators(board_id);
    CREATE INDEX IF NOT EXISTS idx_forum_bans_player ON forum_bans(player_id);
    CREATE INDEX IF NOT EXISTS idx_forum_bans_expires ON forum_bans(expires_at);
    CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON forum_reports(status);
    CREATE INDEX IF NOT EXISTS idx_forum_reports_post ON forum_reports(post_id);
    CREATE INDEX IF NOT EXISTS idx_forum_moderation_log_mod ON forum_moderation_log(moderator_id);

    -- Misc user content / admin / resource
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      kingdom_id INTEGER,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS changelog_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      body_md TEXT,
      category TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_id INTEGER,
      author_name TEXT,
      discord_sent INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS bug_reports (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      kingdom_id INTEGER,
      username TEXT,
      kingdom_name TEXT,
      category TEXT NOT NULL DEFAULT 'bug',
      message TEXT NOT NULL,
      context_panel TEXT,
      page_url TEXT,
      user_agent TEXT,
      console_log TEXT,
      discord_sent INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS admin_notes (
      id SERIAL PRIMARY KEY,
      author_name TEXT,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wishlist (
      id SERIAL PRIMARY KEY,
      category TEXT,
      description TEXT,
      completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_goal_definitions (
      id SERIAL PRIMARY KEY,
      tier TEXT NOT NULL,
      goal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tier, goal_id)
    );
    CREATE INDEX IF NOT EXISTS idx_admin_goals_tier ON admin_goal_definitions(tier, active);

    CREATE TABLE IF NOT EXISTS admin_game_constants (
      id SERIAL PRIMARY KEY,
      section TEXT NOT NULL,
      constant_key TEXT NOT NULL,
      override_value TEXT NOT NULL,
      data_type TEXT NOT NULL DEFAULT 'number',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(section, constant_key)
    );
    CREATE INDEX IF NOT EXISTS idx_admin_constants_section ON admin_game_constants(section);

    CREATE TABLE IF NOT EXISTS resource_nodes (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER REFERENCES kingdoms(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      distance INTEGER NOT NULL,
      richness INTEGER NOT NULL DEFAULT 1,
      discovered_at INTEGER,
      map_x INTEGER,
      map_y INTEGER,
      terrain TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_resource_nodes_kingdom ON resource_nodes(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_resource_nodes_coords ON resource_nodes(map_x, map_y);

    -- Lava vents (volcanic hex state) — FORGE_SYSTEM.md §15 A1 / §15.4
    CREATE TABLE IF NOT EXISTS lava_vents (
      hex_col INTEGER NOT NULL,
      hex_row INTEGER NOT NULL,
      occupying_kingdom_id INTEGER REFERENCES kingdoms(id) ON DELETE SET NULL,
      dormant_until TIMESTAMPTZ,
      PRIMARY KEY (hex_col, hex_row)
    );
    CREATE INDEX IF NOT EXISTS idx_lava_vents_occupying ON lava_vents(occupying_kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_lava_vents_dormant ON lava_vents(dormant_until);

    CREATE TABLE IF NOT EXISTS resource_expeditions (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      node_id INTEGER NOT NULL REFERENCES resource_nodes(id),
      population_sent INTEGER NOT NULL,
      depart_at INTEGER NOT NULL,
      arrive_at INTEGER NOT NULL,
      harvest_ends_at INTEGER,
      return_at INTEGER,
      status TEXT NOT NULL DEFAULT 'outbound',
      loot TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_res_expeditions_kingdom ON resource_expeditions(kingdom_id, status);
    CREATE INDEX IF NOT EXISTS idx_res_expeditions_kingdom_recent ON resource_expeditions(kingdom_id, status, depart_at DESC);
    CREATE INDEX IF NOT EXISTS idx_res_expeditions_kingdom_depart ON resource_expeditions(kingdom_id, depart_at DESC);

    -- Turn-based node harvesting (replaces resource_expeditions' real-time
    -- outbound/harvesting/returning model): travel_turns is a fixed cost
    -- computed once at launch (1.5 turns/hex, round trip included, matching
    -- game/location-distance.js's dungeon/mountain convention), harvest_turns
    -- is player-chosen (higher turns = higher yield), turns_left counts both
    -- down together each turn tick until the party returns.
    CREATE TABLE IF NOT EXISTS resource_harvests (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      node_id INTEGER NOT NULL REFERENCES resource_nodes(id),
      population_sent INTEGER NOT NULL,
      travel_turns INTEGER NOT NULL,
      harvest_turns INTEGER NOT NULL,
      turns_left INTEGER NOT NULL,
      food_taken INTEGER NOT NULL DEFAULT 0,
      resource_type TEXT NOT NULL,
      richness INTEGER NOT NULL DEFAULT 1,
      yield_amount INTEGER,
      rewards_claimed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_resource_harvests_kingdom ON resource_harvests(kingdom_id, turns_left);

    -- Discord / chat sync / world seed / test
    CREATE TABLE IF NOT EXISTS discord_links (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL UNIQUE REFERENCES players(id),
      discord_user_id TEXT NOT NULL UNIQUE,
      discord_username TEXT NOT NULL,
      linked_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_discord_links_player ON discord_links(player_id);
    CREATE INDEX IF NOT EXISTS idx_discord_links_discord_user ON discord_links(discord_user_id);

    CREATE TABLE IF NOT EXISTS chat_sync_log (
      id SERIAL PRIMARY KEY,
      game_message_id INTEGER REFERENCES chat_messages(id),
      discord_message_id TEXT,
      direction TEXT NOT NULL,
      synced_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_sync_log_game_msg ON chat_sync_log(game_message_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sync_log_discord_msg ON chat_sync_log(discord_message_id);

    CREATE TABLE IF NOT EXISTS discord_sync_config (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL UNIQUE,
      channel_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sync_both_directions INTEGER NOT NULL DEFAULT 1,
      game_room TEXT NOT NULL DEFAULT 'global',
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_discord_sync_config_channel ON discord_sync_config(channel_id);

    CREATE TABLE IF NOT EXISTS world_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      seed BIGINT NOT NULL,
      generated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      CONSTRAINT world_state_singleton CHECK (id = 1)
    );

    CREATE TABLE IF NOT EXISTS discord_link_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      discord_user_id TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      game_username TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_token ON discord_link_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_expires ON discord_link_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS test_results (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      player_name TEXT NOT NULL,
      test_key TEXT NOT NULL,
      test_group TEXT NOT NULL,
      test_name TEXT NOT NULL,
      passed INTEGER,
      comment TEXT,
      submitted_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_test_results_key ON test_results(test_key);
    CREATE INDEX IF NOT EXISTS idx_test_results_player ON test_results(player_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_submitted ON test_results(submitted_at DESC);

    CREATE TABLE IF NOT EXISTS happiness_history (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      turn INTEGER NOT NULL,
      happiness_value INTEGER NOT NULL,
      food_component INTEGER DEFAULT 0,
      entertainment_component INTEGER DEFAULT 0,
      safety_component INTEGER DEFAULT 0,
      prosperity_component INTEGER DEFAULT 0,
      race_modifier INTEGER DEFAULT 0,
      tax_component INTEGER DEFAULT 0,
      overcrowding_component INTEGER DEFAULT 0,
      recovery_rate REAL DEFAULT 0,
      effects_component INTEGER DEFAULT 0,
      synergy_component INTEGER DEFAULT 0,
      fragment_component INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      UNIQUE(kingdom_id, turn)
    );
    CREATE INDEX IF NOT EXISTS idx_happiness_history_kingdom_turn ON happiness_history(kingdom_id, turn DESC);
    CREATE INDEX IF NOT EXISTS idx_happiness_history_kingdom_created ON happiness_history(kingdom_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS happiness_events (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      turn INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      old_happiness INTEGER,
      new_happiness INTEGER,
      component TEXT,
      delta INTEGER,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_happiness_events_kingdom_turn ON happiness_events(kingdom_id, turn DESC);
    CREATE INDEX IF NOT EXISTS idx_happiness_events_kingdom_created ON happiness_events(kingdom_id, created_at DESC);

    -- Final small tables carved from schema (bounties, events, nodes, trade_offers, lore)
    CREATE TABLE IF NOT EXISTS bounties (
      id SERIAL PRIMARY KEY,
      target_id INTEGER NOT NULL REFERENCES kingdoms(id),
      posted_by INTEGER NOT NULL REFERENCES players(id),
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      completed_at INTEGER,
      claimed_by_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_id, status);
    CREATE INDEX IF NOT EXISTS idx_bounties_active ON bounties(status, amount DESC);

    CREATE TABLE IF NOT EXISTS lore_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS random_events (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS junk_events (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS tax_events (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );

    CREATE TABLE IF NOT EXISTS trade_offers (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES kingdoms(id),
      sender_name TEXT NOT NULL,
      receiver_id INTEGER NOT NULL REFERENCES kingdoms(id),
      receiver_name TEXT NOT NULL,
      offer TEXT NOT NULL,
      request TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON trade_offers(receiver_id, status);
    CREATE INDEX IF NOT EXISTS idx_trade_offers_sender_created ON trade_offers(sender_id, created_at DESC);
`;

async function applySchema(db) {
  // Clean any legacy table from early development that referenced a non-existent
  // regions(id). The real location data lives in world_locations (region_name).
  // Safe no-op if absent. Prevents FK errors on boot.
  await db.exec(`DROP TABLE IF EXISTS region_locations;`);

  // Full schema (CREATE IF NOT EXISTS). Tables are defined in dependency order
  // inside coreSchema (e.g. players/kingdoms/alliances before regions).
  await db.exec(coreSchema);
}

module.exports = { applySchema };
