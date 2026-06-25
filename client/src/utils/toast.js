import { repairMojibake } from './repairMojibake.js';

let toastEmitter = null;

const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const MOJIBAKE_EMOJI_PREFIX = /^(?:[\u00F0\u00E2\u00EF][\u0080-\u00FF]{1,6})\s*/u;

function stripToastEmojis(message) {
  let text = repairMojibake(String(message ?? ''));

  for (let pass = 0; pass < 6; pass += 1) {
    const prev = text;
    text = text
      .replace(EMOJI_PATTERN, '')
      .replace(MOJIBAKE_EMOJI_PREFIX, '')
      .replace(/[\uFE0F\u200D]/g, '')
      .replace(/[\uFFFD\uFFFE\uFFFF]+/g, '')
      .replace(/^\?+\s*/g, '')
      .trimStart();
    if (text === prev) break;
  }

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim();
}

export function registerToastEmitter(fn) {
  toastEmitter = typeof fn === 'function' ? fn : null;
  return () => {
    if (toastEmitter === fn) toastEmitter = null;
  };
}

export function cleanMessageText(message) {
  return stripToastEmojis(message);
}

export function toast(message, type = 'info') {
  const text = stripToastEmojis(message);
  if (!text) return;
  const kind = type || 'info';
  if (toastEmitter) {
    toastEmitter(text, kind);
    return;
  }
  const level = kind === 'error' ? 'error' : (kind === 'warn' || kind === 'warning') ? 'warn' : 'log';
  console[level](`[toast:${kind}]`, text);
}