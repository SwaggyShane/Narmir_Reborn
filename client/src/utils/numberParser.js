/**
 * Parse numerical shorthand notation (k, m, b, t)
 * Examples: "1k" -> 1000, "2.5m" -> 2500000, "1b" -> 1000000000
 * @param {string|number} input - The input value to parse
 * @returns {number} The parsed number, or 0 if invalid
 */
export function parseNumberWithShorthand(input) {
  if (typeof input === 'number') {
    return Math.max(0, Math.floor(input));
  }

  if (!input || typeof input !== 'string') {
    return 0;
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return 0;

  // Match number (including decimals) followed by optional shorthand
  const match = trimmed.match(/^([\d.]+)\s*([kmbt])?$/);
  if (!match) return 0;

  const [, numStr, shorthand] = match;
  let num = parseFloat(numStr);

  if (isNaN(num) || num < 0) return 0;

  // Apply shorthand multiplier
  const multipliers = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
    t: 1_000_000_000_000,
  };

  if (shorthand && multipliers[shorthand]) {
    num *= multipliers[shorthand];
  }

  return Math.floor(num);
}

/**
 * Format a large number with shorthand notation for display
 * Examples: 1000 -> "1k", 2500000 -> "2.5m"
 * @param {number} num - The number to format
 * @returns {string} Formatted number with shorthand
 */
export function formatNumberWithShorthand(num) {
  if (num < 1_000) return num.toString();

  const thresholds = [
    { value: 1_000_000_000, suffix: 'b' },
    { value: 1_000_000, suffix: 'm' },
    { value: 1_000, suffix: 'k' },
  ];

  for (const { value, suffix } of thresholds) {
    if (num >= value) {
      const formatted = (num / value).toFixed(1);
      // Remove trailing .0
      return formatted.endsWith('.0') ? formatted.slice(0, -2) + suffix : formatted + suffix;
    }
  }

  return num.toString();
}
