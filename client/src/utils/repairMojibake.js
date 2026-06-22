const MOJIBAKE_SIGNATURE = /[\u00C3\u00C2\u00E2\u00EF\uFFFD]/;

export function repairMojibake(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!text || !MOJIBAKE_SIGNATURE.test(text)) return text;

  let current = text;
  for (let i = 0; i < 5; i += 1) {
    let next = current;
    try {
      next = decodeURIComponent(escape(current));
    } catch (err) {
      try {
        next = new TextDecoder('utf-8').decode(
          Uint8Array.from(current, (ch) => ch.charCodeAt(0) & 255),
        );
      } catch (innerErr) {
        break;
      }
    }

    if (!next || next === current) break;
    current = next;
  }

  return current;
}
