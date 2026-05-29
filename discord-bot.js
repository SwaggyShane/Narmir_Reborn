const { Client, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('path');
const http = require('http');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const UPDATES_CHANNEL_ID = process.env.DISCORD_UPDATES_CHANNEL_ID;
const GAME_SERVER_URL = process.env.GAME_SERVER_URL || 'http://localhost:3000';

let db = null;

console.log('🔍 Environment Variables Check:');
console.log('  DISCORD_BOT_TOKEN:', DISCORD_TOKEN ? `✓ Set (${DISCORD_TOKEN.length} chars)` : '❌ NOT SET');
console.log('  DISCORD_UPDATES_CHANNEL_ID:', UPDATES_CHANNEL_ID || '⚠️  Not set');

if (!DISCORD_TOKEN) {
  console.error('❌ CRITICAL: DISCORD_BOT_TOKEN is missing!');
  console.error('Make sure DISCORD_BOT_TOKEN is set as an environment variable in Railway.');
  process.exit(1);
}

// Validate token format
if (!/^[\w\-.]+$/.test(DISCORD_TOKEN)) {
  console.error('❌ CRITICAL: DISCORD_BOT_TOKEN contains invalid characters!');
  console.error('Token contains: ' + DISCORD_TOKEN.split('').filter(c => !/[\w\-.]/.test(c)).join(', '));
  console.error('Valid characters are: alphanumeric, hyphen (-), underscore (_), period (.)');
  process.exit(1);
}

if (DISCORD_TOKEN.length < 50) {
  console.error('❌ CRITICAL: DISCORD_BOT_TOKEN is too short!');
  console.error(`Token length: ${DISCORD_TOKEN.length} (expected 70+)`);
  process.exit(1);
}

client.once('ready', async () => {
  console.log(`✅ Discord Bot logged in as ${client.user.tag}`);
  console.log(`📢 Updates channel ID: ${UPDATES_CHANNEL_ID || 'Not configured'}`);
  console.log(`🎮 Game server URL: ${GAME_SERVER_URL}`);

  // Initialize database connection
  try {
    const { initDb } = require('./db/schema');
    db = await initDb();
    console.log('✅ Database connected for Discord sync');

    // Load sync configs from database
    await loadSyncConfigs();

    // Start polling game messages
    pollAndSyncGameMessages();
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    console.error('Discord sync will be unavailable until database connects.');
  }
});

let syncConfigs = [];
let lastSyncTime = Math.floor(Date.now() / 1000) - 300; // Start 5 minutes in the past
let isPolling = false; // Lock to prevent concurrent polling

async function loadSyncConfigs() {
  if (!db) return;
  try {
    syncConfigs = await db.all('SELECT * FROM discord_sync_config WHERE enabled = 1');
    console.log(`📡 Loaded ${syncConfigs.length} Discord sync channel(s)`);
  } catch (error) {
    console.error('❌ Failed to load sync configs:', error);
    syncConfigs = [];
  }
}

async function pollAndSyncGameMessages() {
  if (isPolling) return; // Prevent concurrent executions
  if (!db || !client.isReady() || syncConfigs.length === 0) return;

  isPolling = true;
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    const lookbackTime = currentTime - 300; // 5-minute lookback to retry transient failures

    // Find unsync'd game messages — filter out any already synced in either direction
    const recentMessages = await db.all(`
      SELECT cm.id, cm.player_id, cm.username, cm.message, cm.room, cm.created_at
      FROM chat_messages cm
      WHERE cm.created_at > ? AND cm.created_at <= ?
        AND cm.id NOT IN (SELECT game_message_id FROM chat_sync_log WHERE game_message_id IS NOT NULL)
      ORDER BY cm.created_at ASC
      LIMIT 50
    `, [lookbackTime, currentTime]);

    for (const msg of recentMessages) {
      await relayGameMessageToDiscord(msg);
    }
  } catch (error) {
    console.error('❌ Error polling game messages:', error);
  } finally {
    isPolling = false;
  }
}

// Poll for new game messages every 5 seconds
setInterval(pollAndSyncGameMessages, 5000);

// Periodically reload sync configs and clean up expired tokens
setInterval(async () => {
  await loadSyncConfigs();
  if (db) {
    try {
      await db.run('DELETE FROM discord_link_tokens WHERE expires_at < ?', [Math.floor(Date.now() / 1000)]);
    } catch (e) {
      console.error('❌ Failed to clean up expired link tokens:', e);
    }
  }
}, 30000);

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if this channel is configured for game chat sync
  const syncConfig = syncConfigs.find(c => c.channel_id === message.channelId);
  if (syncConfig && syncConfig.sync_both_directions) {
    try {
      await relayDiscordMessageToGame(message, syncConfig);
    } catch (error) {
      console.error('❌ Failed to relay Discord message to game:', error);
    }
  }

  // Handle !link <gamename> command — generates a verification code sent via DM
  if (message.content.startsWith('!link')) {
    // Only allow in guild channels, not DMs
    if (!message.guild) {
      return message.reply('❌ Please use `!link` in the Narmir Reborn Discord server, not in DMs.');
    }

    if (!db) {
      return message.reply('❌ Database not connected. Please try again shortly.');
    }

    const gameName = message.content.slice(5).trim();
    if (!gameName) {
      return message.reply('❌ Usage: `!link YourGameUsername`');
    }

    try {
      // Check the game username exists
      const player = await db.get('SELECT id, username FROM players WHERE LOWER(username) = LOWER(?)', [gameName]);
      if (!player) {
        return message.reply(`❌ No game account found with username **${gameName}**. Check your spelling.`);
      }

      // Generate a 6-char uppercase alphanumeric token (cryptographically secure)
      const crypto = require('crypto');
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let token = '';
      for (let i = 0; i < 6; i++) token += chars[crypto.randomInt(0, chars.length)];

      const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes

      // Delete any existing token for this Discord user and upsert new one
      await db.run('DELETE FROM discord_link_tokens WHERE discord_user_id = ?', [message.author.id]);
      await db.run(
        'INSERT INTO discord_link_tokens (token, discord_user_id, discord_username, game_username, expires_at) VALUES (?, ?, ?, ?, ?)',
        [token, message.author.id, message.author.username, player.username, expiresAt]
      );

      // DM the token to the user
      try {
        await message.author.send(
          `🔮 **Narmir Reborn — Discord Link Code**\n\n` +
          `Your verification code is: **\`${token}\`**\n\n` +
          `Enter this code in **Settings → Discord** in the game to link your account.\n` +
          `This code expires in **10 minutes**.\n\n` +
          `Linking account: **${player.username}**`
        );
        await message.reply(`✅ A verification code has been sent to your DMs! Enter it in **Settings → Discord** in-game.`);
      } catch (dmError) {
        // DMs are disabled — do NOT expose the token publicly (security risk)
        await message.reply(
          `❌ I couldn't DM you. Please enable DMs from server members in Discord Settings → Privacy & Safety, then try again. Alternatively, use **Method 2 (Manual Entry)** in Settings → Discord.`
        );
        // Delete the token since we couldn't deliver it securely
        await db.run('DELETE FROM discord_link_tokens WHERE discord_user_id = ?', [message.author.id]);
      }
    } catch (error) {
      console.error('❌ Error processing !link command:', error);
      message.reply('❌ An error occurred. Please try again.');
    }
    return;
  }

  // Handle !attack command — plays sound in #general voice channel
  if (message.content === '!attack') {
    try {
      // Find #general voice channel
      const generalChannel = message.guild.channels.cache.find(
        ch => ch.name === 'general' && ch.isVoiceBased()
      );

      if (!generalChannel) {
        return message.reply('❌ Could not find #general voice channel');
      }

      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: generalChannel.id,
        guildId: message.guildId,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      // Create audio player and load the attack sound
      const player = createAudioPlayer();
      const soundPath = path.join(__dirname, 'public', 'sound', 'monty_python_i_fart.mp3');
      const resource = createAudioResource(soundPath);

      connection.subscribe(player);
      player.play(resource);

      // Leave when sound finishes
      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });

      await message.react('⚔️');
    } catch (error) {
      console.error('❌ Attack sound error:', error);
      message.reply('❌ Failed to play attack sound');
    }
    return;
  }

  // Listen for !update command
  if (!message.content.startsWith('!update')) return;

  try {
    // Security: Restrict to administrators and ensure we are in a guild context
    if (!message.guild || !message.member?.permissions.has('Administrator')) {
      return message.reply('❌ This command can only be used by administrators within a server.');
    }

    // Parse command: !update title:"Title" description:"Description" date:"2026-05-24"
    const args = message.content.slice(8).trim(); // Remove "!update "

    if (!args) {
      return message.reply(
        '❌ Usage: `!update title:"Your Title" description:"Your Description" date:"YYYY-MM-DD"`'
      );
    }

    // Parse key:"value" format
    const titleMatch = args.match(/title:"([^"]*)"/);
    const descMatch = args.match(/description:"([^"]*)"/);
    const dateMatch = args.match(/date:"([^"]*)"/);

    if (!titleMatch || !descMatch || !dateMatch) {
      return message.reply(
        '❌ Missing required fields. Usage: `!update title:"Your Title" description:"Your Description" date:"YYYY-MM-DD"`'
      );
    }

    const title = titleMatch[1];
    const description = descMatch[1];
    const date = dateMatch[1];

    // Validate date format and validity
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date) || isNaN(Date.parse(date))) {
      return message.reply('❌ Invalid date. Please use a valid YYYY-MM-DD format.');
    }

    // Get or create updates channel
    let updatesChannel = null;

    if (UPDATES_CHANNEL_ID) {
      updatesChannel = await client.channels.fetch(UPDATES_CHANNEL_ID).catch(() => null);
      // Verify channel is text-based
      if (updatesChannel && !updatesChannel.isTextBased()) {
        updatesChannel = null;
      }
    }

    if (!updatesChannel) {
      // Try to find #updates channel by name
      updatesChannel = message.guild.channels.cache.find(
        ch => ch.name === 'updates' && ch.type === ChannelType.GuildText
      );
    }

    if (!updatesChannel) {
      return message.reply(
        '❌ Could not find #updates channel. Please configure DISCORD_UPDATES_CHANNEL_ID in environment variables.'
      );
    }

    // Create formatted embed
    const embed = new EmbedBuilder()
      .setColor('#ff9800') // Narmir gold/orange
      .setTitle(`🔮 ${title}`)
      .setDescription(description)
      .setFooter({
        text: `Narmir Reborn • ${date}`,
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    // Post to updates channel
    await updatesChannel.send({ embeds: [embed] });

    // Confirm to user
    message.reply(`✅ Update posted to ${updatesChannel.toString()}!`);

  } catch (error) {
    console.error('Error processing update command:', error);
    message.reply('❌ An error occurred while posting the update. Check bot logs.');
  }
});

async function relayDiscordMessageToGame(discordMessage, syncConfig) {
  if (!db) {
    console.warn('⚠️  Database not connected, skipping Discord→game relay');
    return;
  }

  const content = discordMessage.content.trim();
  if (!content) return;

  try {
    // Find Discord user link
    const link = await db.get(
      'SELECT player_id FROM discord_links WHERE discord_user_id = ?',
      [discordMessage.author.id]
    );

    if (!link) {
      // Message from unlinked Discord user - store with NULL kingdom_id as Discord relay
      const displayName = `[Discord] ${discordMessage.author.username}`;
      const result = await db.run(
        'INSERT INTO chat_messages (kingdom_id, player_id, username, room, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [null, 0, discordMessage.author.username, syncConfig.game_room, content, Math.floor(Date.now() / 1000)]
      );

      // Log the sync
      if (result?.lastID) {
        await db.run(
          'INSERT INTO chat_sync_log (game_message_id, discord_message_id, direction, synced_at) VALUES (?, ?, ?, ?)',
          [result.lastID, discordMessage.id, 'discord_to_game', Math.floor(Date.now() / 1000)]
        );
      }
      console.log(`📩 Synced Discord message from @${discordMessage.author.username} to game chat`);
      return;
    }

    // Get player's kingdom ID and username with a single query
    const player = await db.get(
      'SELECT k.id AS kingdom_id, p.username FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.player_id = ?',
      [link.player_id]
    );

    if (!player) return;

    // Insert chat message into game database using player's game username
    const result = await db.run(
      'INSERT INTO chat_messages (kingdom_id, player_id, username, room, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [player.kingdom_id, link.player_id, player.username, syncConfig.game_room, content, Math.floor(Date.now() / 1000)]
    );

    // Log the sync
    await db.run(
      'INSERT INTO chat_sync_log (game_message_id, discord_message_id, direction, synced_at) VALUES (?, ?, ?, ?)',
      [result.lastID, discordMessage.id, 'discord_to_game', Math.floor(Date.now() / 1000)]
    );

    console.log(`📩 Synced Discord message from ${player.username} (Discord @${discordMessage.author.username}) to game chat`);
  } catch (error) {
    console.error('❌ Error relaying Discord message to game:', error);
  }
}

async function relayGameMessageToDiscord(gameMessage) {
  if (!db || !client.isReady()) return;

  try {
    // Validate message has required fields
    if (!gameMessage.id || !gameMessage.username || !gameMessage.message || !gameMessage.room) {
      console.warn('⚠️  Incomplete game message, skipping:', gameMessage);
      return;
    }

    // Find sync configs for this game room
    const configs = syncConfigs.filter(c => c.game_room === gameMessage.room);
    if (configs.length === 0) return;

    for (const config of configs) {
      // Use cache first to avoid hitting Discord API rate limits
      const channel = client.channels.cache.get(config.channel_id) || await client.channels.fetch(config.channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        console.warn(`⚠️  Discord channel ${config.channel_id} not found or not text-based`);
        continue;
      }

      // Find Discord user if linked (only if player_id exists)
      let discordUserMention = `@${gameMessage.username}`;
      if (gameMessage.player_id) {
        const link = await db.get(
          'SELECT discord_user_id FROM discord_links WHERE player_id = ?',
          [gameMessage.player_id]
        ).catch(() => null);

        if (link?.discord_user_id) {
          discordUserMention = `<@${link.discord_user_id}>`;
        }
      }

      const messageText = `**${gameMessage.username}** (${discordUserMention}): ${gameMessage.message}`;

      // Disable mention parsing to prevent @everyone/@here abuse
      const discordMsg = await channel.send({
        content: messageText,
        allowedMentions: { parse: [] }
      }).catch(error => {
        console.error(`❌ Failed to send message to Discord channel ${config.channel_id}:`, error.message);
        return null;
      });

      if (discordMsg) {
        // Log the sync
        await db.run(
          'INSERT INTO chat_sync_log (game_message_id, discord_message_id, direction, synced_at) VALUES (?, ?, ?, ?)',
          [gameMessage.id, discordMsg.id, 'game_to_discord', Math.floor(Date.now() / 1000)]
        ).catch(error => {
          console.error('❌ Failed to log chat sync:', error);
        });
        console.log(`📤 Synced game message from ${gameMessage.username} to Discord #${config.channel_name}`);
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error relaying game message to Discord:', error);
  }
}

// Export function for use by the game server
module.exports.relayGameMessageToDiscord = relayGameMessageToDiscord;

client.login(DISCORD_TOKEN).catch(error => {
  console.error('❌ Failed to login to Discord:');
  console.error('  Error:', error.message);
  if (error.code === 'UND_ERR_INVALID_ARG') {
    console.error('  This usually means the token contains invalid characters.');
    console.error('  Check that DISCORD_BOT_TOKEN is set correctly in Railway.');
  }
  process.exit(1);
});
