// Mirrors game/lib/timestamp.js for client-side use
// (Cannot directly import due to server/client module system separation)

// Age in ms since a created_at value (unix seconds, ms, or ISO string)
export function createdAtAgeMs(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return Infinity;
  const num = Number(value);
  if (Number.isFinite(num)) {
    if (num > 1_000_000_000_000) return Date.now() - num;
    if (num > 1_000_000_000) return Date.now() - num * 1000;
    return Date.now() - num;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? Infinity : Date.now() - d.getTime();
}

// Format timestamp for display (long format with locale)
// NOTE: Uses browser locale/timezone intentionally (not server's America/New_York).
// Users see times in their own timezone. See game/ARCHITECTURE.md for rationale.
export function formatTimestamp(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return '-';
  const num = Number(value);
  let d;
  if (Number.isFinite(num)) {
    d = new Date(num > 1_000_000_000_000 ? num : (num > 1_000_000_000 ? num * 1000 : num));
  } else {
    d = new Date(value);
  }
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

// Format timestamp for display (short date format)
// NOTE: Uses browser locale/timezone intentionally (not server's America/New_York).
// Users see dates in their own timezone. See game/ARCHITECTURE.md for rationale.
export function formatTimestampShort(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return '';
  const num = Number(value);
  let d;
  if (Number.isFinite(num)) {
    d = new Date(num > 1_000_000_000_000 ? num : (num > 1_000_000_000 ? num * 1000 : num));
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Current unix timestamp (seconds)
export function nowUnix() {
  return Math.floor(Date.now() / 1000);
}