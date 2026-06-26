/** Age in ms since a created_at value (unix seconds, ms, or ISO string). */
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

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

module.exports = { createdAtAgeMs, formatTimestamp, nowUnix };