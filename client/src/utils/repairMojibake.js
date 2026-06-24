const MOJIBAKE_SIGNATURE = /[\u00C3\u00C2\u00E2\u00EF\u00F0\u00C5\uFFFD]/;

const CP1252_TO_BYTE = new Map([
  [0x20AC, 0x80],
  [0x201A, 0x82],
  [0x0192, 0x83],
  [0x201E, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02C6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8A],
  [0x2039, 0x8B],
  [0x0152, 0x8C],
  [0x017D, 0x8E],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201C, 0x93],
  [0x201D, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02DC, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9A],
  [0x203A, 0x9B],
  [0x0153, 0x9C],
  [0x017E, 0x9E],
  [0x0178, 0x9F],
]);

const UTF8_DECODER = new TextDecoder('utf-8');

function toCp1252Byte(ch) {
  const code = ch.codePointAt(0);
  if (code <= 0x7f) return code;
  if (code >= 0x80 && code <= 0x9f) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  return CP1252_TO_BYTE.get(code) ?? null;
}

function decodeCp1252Utf8Once(text) {
  const bytes = [];
  for (const ch of text) {
    const byte = toCp1252Byte(ch);
    if (byte === null) return null;
    bytes.push(byte);
  }

  try {
    return UTF8_DECODER.decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

function decodeRepeatedly(text) {
  let current = text;
  for (let i = 0; i < 5; i += 1) {
    const next = decodeCp1252Utf8Once(current);
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

function decodeLatin1Utf8Once(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }

  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
}

function decodeLatin1Repeatedly(text) {
  let current = text;
  for (let i = 0; i < 20; i += 1) {
    const next = decodeLatin1Utf8Once(current);
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

function polishCommonMojibake(text) {
  return text
    .replace(/\u00c2/g, '')
    .replace(/\u00e2\u20ac\u201d/g, '\u2014')
    .replace(/\u00e2\u20ac\u201c/g, '-')
    .replace(/\u00e2\u20ac\u00a2/g, '\u2022')
    .replace(/\u00e2\u20ac\u02dc|\u00e2\u20ac\u2122/g, '\u2019')
    .replace(/\u00e2\u20ac\u0153/g, '\u201c');
}

function scrubCorruptedEmojiMarkers(text) {
  return String(text)
    .replace(/^\?+\s*/g, '')
    .replace(/\s+\?\s+(?=Net Gold)/gi, ' — ')
    .replace(/[\uFFFD\uFFFE\uFFFF]+/g, '');
}

export function repairMojibake(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!text) return text;

  let repaired = text;
  if (MOJIBAKE_SIGNATURE.test(text)) {
    repaired = decodeRepeatedly(text);
    repaired = decodeLatin1Repeatedly(repaired);
    repaired = polishCommonMojibake(repaired);
    repaired = scrubCorruptedEmojiMarkers(repaired);
  }

  return repaired || text;
}
