const { Client, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');
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

console.log('🔍 Environment Variables Check:');
console.log('  DISCORD_BOT_TOKEN:', DISCORD_TOKEN ? `✓ Set (${DISCORD_TOKEN.length} chars)` : '❌ NOT SET');
console.log('  DISCORD_UPDATES_CHANNEL_ID:', UPDATES_CHANNEL_ID || '⚠️  Not set');

if (!DISCORD_TOKEN) {
  console.error('❌ CRITICAL: DISCORD_BOT_TOKEN is missing!');
  console.error('Make sure DISCORD_BOT_TOKEN is set as an environment variable in Railway.');
  process.exit(1);
}

// Validate token format
if (!/^[\w\-\.]+$/.test(DISCORD_TOKEN)) {
  console.error('❌ CRITICAL: DISCORD_BOT_TOKEN contains invalid characters!');
  console.error('Token contains: ' + DISCORD_TOKEN.split('').filter(c => !/[\w\-\.]/.test(c)).join(', '));
  console.error('Valid characters are: alphanumeric, hyphen (-), underscore (_), period (.)');
  process.exit(1);
}

if (DISCORD_TOKEN.length < 50) {
  console.error('❌ CRITICAL: DISCORD_BOT_TOKEN is too short!');
  console.error(`Token length: ${DISCORD_TOKEN.length} (expected 70+)`);
  process.exit(1);
}

client.once('ready', () => {
  console.log(`✅ Discord Bot logged in as ${client.user.tag}`);
  console.log(`📢 Updates channel ID: ${UPDATES_CHANNEL_ID || 'Not configured'}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

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

client.login(DISCORD_TOKEN).catch(error => {
  console.error('❌ Failed to login to Discord:');
  console.error('  Error:', error.message);
  if (error.code === 'UND_ERR_INVALID_ARG') {
    console.error('  This usually means the token contains invalid characters.');
    console.error('  Check that DISCORD_BOT_TOKEN is set correctly in Railway.');
  }
  process.exit(1);
});
