/**
 * PostgreSQL SQL fragments for runtime queries.
 * Use these instead of SQLite dialect (unixepoch, INSERT OR REPLACE, scalar MIN/MAX).
 */

/** Current Unix epoch as integer seconds. */
const EPOCH_NOW = 'FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER';

/** Current Unix epoch cast to text (server_state timestamps). */
const EPOCH_NOW_TEXT = `CAST(${EPOCH_NOW} AS TEXT)`;

module.exports = {
  EPOCH_NOW,
  EPOCH_NOW_TEXT,
};