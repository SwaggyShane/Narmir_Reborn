/** Build PostgreSQL positional placeholders for dynamic SQL. */

function pgPlaceholder(index) {
  return `$${index}`;
}

function pgPlaceholders(count, start = 1) {
  return Array.from({ length: count }, (_, i) => `$${start + i}`);
}

function pgInList(count, start = 1) {
  return pgPlaceholders(count, start).join(', ');
}

function pgSetClause(columns, start = 1) {
  return columns.map((col, i) => `"${col}" = $${start + i}`).join(', ');
}

module.exports = {
  pgPlaceholder,
  pgPlaceholders,
  pgInList,
  pgSetClause,
};