const { postChangelogToDiscord } = require('./discord-notify');
const { buildBodyMd, stripMarkdown } = require('./changelog-format');

/**
 * Save a changelog entry and push to #updates when Discord is configured.
 */
async function publishChangelogEntry(db, {
  title,
  description,
  category = null,
  source = 'manual',
  sourceId = null,
  authorName = null,
}) {
  const cleanTitle = String(title ?? '').trim();
  const cleanDesc = String(description ?? '').trim();
  if (!cleanTitle || !cleanDesc) {
    throw new Error('Title and description are required');
  }

  const bodyMd = buildBodyMd({ title: cleanTitle, description: cleanDesc, category });

  const insert = await db.run(
    `INSERT INTO changelog_entries (title, description, body_md, category, source, source_id, author_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      cleanTitle.slice(0, 200),
      cleanDesc.slice(0, 4000),
      bodyMd.slice(0, 8000),
      category ? String(category).slice(0, 64) : null,
      source,
      sourceId,
      authorName,
    ],
  );

  const entryId = insert?.lastID ?? null;
  const discordSent = await postChangelogToDiscord({
    title: cleanTitle,
    description: stripMarkdown(bodyMd),
    category,
    entryId,
  });

  if (discordSent && entryId) {
    await db.run('UPDATE changelog_entries SET discord_sent = 1 WHERE id = ?', [entryId]);
  }

  return { id: entryId, discordSent, bodyMd };
}

module.exports = { publishChangelogEntry };