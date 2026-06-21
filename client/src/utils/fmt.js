export function fmt(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Math.round(num).toLocaleString() : '0';
}
