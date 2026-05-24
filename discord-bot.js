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

if (!DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_BOT_TOKEN not set in environment variables');
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

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return message.reply('❌ Invalid date format. Use YYYY-MM-DD');
    }

    // Get or create updates channel
    let updatesChannel = null;

    if (UPDATES_CHANNEL_ID) {
      updatesChannel = await client.channels.fetch(UPDATES_CHANNEL_ID).catch(() => null);
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
        iconURL: 'https://cdn.discordapp.com/app-icons/1234567890/abcdef.png' // Optional: replace with Narmir icon
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

client.login(DISCORD_TOKEN);
