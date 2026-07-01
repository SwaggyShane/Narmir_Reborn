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

/**
 * SET clause for an UPDATE, plus the next placeholder (e.g. for a WHERE id = $N).
 * Centralizes the "N field placeholders, then one more" pattern so callers
 * can't accidentally reuse $1 for the WHERE clause.
 */
function pgSetClauseWithNextPlaceholder(columns, start = 1) {
  return {
    setClause: pgSetClause(columns, start),
    nextPlaceholder: pgPlaceholder(start + columns.length),
  };
}

/** Multi-row INSERT VALUES tuples: ($1,$2),($3,$4), ... */
function pgValueTuples(rowCount, columnsPerRow, start = 1) {
  return Array.from({ length: rowCount }, (_, row) => {
    const base = start + row * columnsPerRow;
    const cols = Array.from({ length: columnsPerRow }, (_, col) => `$${base + col}`);
    return `(${cols.join(',')})`;
  }).join(',');
}

module.exports = {
  pgPlaceholder,
  pgPlaceholders,
  pgInList,
  pgSetClause,
  pgSetClauseWithNextPlaceholder,
  pgValueTuples,
};