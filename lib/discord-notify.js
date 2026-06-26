/**
 * Post notifications to Discord from the main server process.
 * Supports webhook URL (preferred) or bot token + channel ID.
 */

function truncate(text, max) {
  const s = String(text ?? '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/**
 * @param {{ title: string, description?: string, fields?: Array<{name: string, value: string, inline?: boolean}>, color?: number }} embed
 * @returns {Promise<boolean>} true if a message was sent
 */
async function postDiscordEmbed(embed) {
  const payload = {
    embeds: [{
      color: embed.color ?? 0xe74c3c,
      title: truncate(embed.title, 256),
      description: embed.description ? truncate(embed.description, 4096) : undefined,
      fields: (embed.fields || []).slice(0, 25).map(f => ({
        name: truncate(f.name, 256),
        value: truncate(f.value, 1024),
        inline: !!f.inline,
      })),
      timestamp: new Date().toISOString(),
    }],
  };

  const webhook = process.env.DISCORD_BUG_REPORTS_WEBHOOK_URL;
  if (webhook) {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[discord-notify] Webhook failed:', res.status, body.slice(0, 200));
      return false;
    }
    return true;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_BUG_REPORTS_CHANNEL_ID;
  if (token && channelId) {
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
      console.warn('[discord-notify] Bot channel post failed:', res.status, body.slice(0, 200));
      return false;
    }
    return true;
  }

  return false;
}

/**
 * @param {{ username: string, kingdomName?: string, category: string, message: string, contextPanel?: string, pageUrl?: string, reportId?: number }} report
 */
async function postBugReportToDiscord(report) {
  try {
    return await postDiscordEmbed({
      title: '🐛 Bug Report',
      color: 0xe74c3c,
      description: report.message,
      fields: [
        { name: 'Player', value: report.username || 'Unknown', inline: true },
        { name: 'Kingdom', value: report.kingdomName || '—', inline: true },
        { name: 'Category', value: report.category || 'bug', inline: true },
        { name: 'Panel', value: report.contextPanel || '—', inline: true },
        { name: 'Report ID', value: report.reportId ? String(report.reportId) : '—', inline: true },
        { name: 'Page', value: report.pageUrl || '—', inline: false },
      ],
    });
  } catch (err) {
    console.warn('[discord-notify] Bug report post error:', err.message || err);
    return false;
  }
}

module.exports = { postDiscordEmbed, postBugReportToDiscord };