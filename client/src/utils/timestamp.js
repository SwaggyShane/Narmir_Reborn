export function formatTimestamp(value) {
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

export function formatTimestampShort(value) {
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