/**
 * Push Discord notifications from the game/admin server on insert events.
 * Uses DISCORD_BOT_TOKEN + channel ID, or optional per-channel webhooks.
 * discord-bot.js polling remains a fallback for bug reports when the web service has no Discord env.
 */

function truncate(text, max) {
  const s = String(text ?? '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/**
 * @param {{ channelIdEnv: string, webhookEnv?: string, embed: object }} opts
 * @returns {Promise<boolean>}
 */
async function postEmbedToChannel({ channelIdEnv, webhookEnv, embed }) {
  const payload = { embeds: [embed] };

  const webhook = webhookEnv ? process.env[webhookEnv] : null;
  if (webhook) {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[discord-notify] Webhook (${webhookEnv}) failed:`, res.status, body.slice(0, 200));
      return false;
    }
    return true;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env[channelIdEnv];
  if (!token || !channelId) return false;

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[discord-notify] Channel post (${channelIdEnv}) failed:`, res.status, body.slice(0, 200));
    return false;
  }
  return true;
}

/**
 * @param {{ username?: string, kingdomName?: string, category?: string, message: string, contextPanel?: string, pageUrl?: string, reportId?: number }} report
 */
function buildBugReportEmbed(report) {
  return {
    color: 0xe74c3c,
    title: '🐛 Bug Report',
    description: truncate(report.message, 4096),
    fields: [
      { name: 'Player', value: truncate(report.username || 'Unknown', 1024), inline: true },
      { name: 'Kingdom', value: truncate(report.kingdomName || '—', 1024), inline: true },
      { name: 'Category', value: truncate(report.category || 'bug', 1024), inline: true },
      { name: 'Panel', value: truncate(report.contextPanel || '—', 1024), inline: true },
      { name: 'Report ID', value: report.reportId ? String(report.reportId) : '—', inline: true },
      { name: 'Page', value: truncate(report.pageUrl || '—', 1024), inline: false },
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * @param {{ title?: string, category?: string, description: string, entryId?: number }} entry
 */
function buildChangelogEmbed(entry) {
  const headline = entry.title
    ? String(entry.title).trim()
    : entry.category
      ? String(entry.category).replace(/_/g, ' ')
      : 'Update';
  const date = new Date().toISOString().slice(0, 10);
  return {
    color: 0xff9800,
    title: `🔮 ${truncate(headline, 240)}`,
    description: truncate(entry.description, 4096),
    footer: { text: `Narmir Reborn • ${date}` },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Player bug report saved to admin → #bug-reports
 */
async function postBugReportToDiscord(report) {
  try {
    return await postEmbedToChannel({
      channelIdEnv: 'DISCORD_BUG_REPORTS_CHANNEL_ID',
      webhookEnv: 'DISCORD_BUG_REPORTS_WEBHOOK_URL',
      embed: buildBugReportEmbed(report),
    });
  } catch (err) {
    console.warn('[discord-notify] Bug report post error:', err.message || err);
    return false;
  }
}

/**
 * Changelog entry published → #updates
 */
async function postChangelogToDiscord(entry) {
  try {
    return await postEmbedToChannel({
      channelIdEnv: 'DISCORD_UPDATES_CHANNEL_ID',
      webhookEnv: 'DISCORD_UPDATES_WEBHOOK_URL',
      embed: buildChangelogEmbed(entry),
    });
  } catch (err) {
    console.warn('[discord-notify] Changelog post error:', err.message || err);
    return false;
  }
}

module.exports = {
  postEmbedToChannel,
  postBugReportToDiscord,
  postChangelogToDiscord,
  buildBugReportEmbed,
  buildChangelogEmbed,
};