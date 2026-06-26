// game/lib/timestamp.js
// Canonical timestamp utility functions (server-side)
// Consolidates from former lib/timestamp-utils.js and client/src/utils/timestamp.js

// Age in ms since a created_at value (unix seconds, ms, or ISO string)
function createdAtAgeMs(value) {
  if (value == null || value === '') return Infinity;
  const num = Number(value);
  if (Number.isFinite(num)) {
    if (num > 1_000_000_000_000) return Date.now() - num;
    if (num > 1_000_000_000) return Date.now() - num * 1000;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? Infinity : Date.now() - d.getTime();
}

// Format timestamp for display (long format with locale)
function formatTimestamp(value) {
  if (value == null || value === '') return '-';
  const num = Number(value);
  let d;
  if (Number.isFinite(num) && num > 1_000_000_000) {
    d = new Date(num > 1_000_000_000_000 ? num : num * 1000);
  } else {
    d = new Date(value);
  }
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

// Format timestamp for display (short date format)
function formatTimestampShort(value) {
  if (value == null || value === '') return '';
  const num = Number(value);
  let d;
  if (Number.isFinite(num) && num > 1_000_000_000) {
    d = new Date(num > 1_000_000_000_000 ? num : num * 1000);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Current unix timestamp (seconds)
function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

module.exports = {
  createdAtAgeMs,
  formatTimestamp,
  formatTimestampShort,
  nowUnix,
};
