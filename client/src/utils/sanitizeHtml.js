import { escapeHtml } from './escapeHtml.js';

const BLOCKED_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'base',
  'link',
  'meta',
  'style',
  'svg',
  'math',
  'template',
  'noscript',
  'animate',
  'set',
  'animateMotion',
  'animateTransform',
]);

const DANGEROUS_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
]);

function stripUnsafeAttributes(element) {
  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase();
    const rawValue = String(attr.value || '').trim();
    const normalizedValue = rawValue.toLowerCase().replace(/\s+/g, '');

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (name === 'style' || name === 'srcdoc') {
      element.removeAttribute(attr.name);
      continue;
    }

    if (name === 'href' || name === 'src' || name === 'xlink:href') {
      for (const protocol of DANGEROUS_PROTOCOLS) {
        if (normalizedValue.startsWith(protocol)) {
          element.removeAttribute(attr.name);
          break;
        }
      }
    }
  }
}

export function sanitizeHtml(html) {
  if (html == null || html === '') return '';
  if (typeof document === 'undefined') return escapeHtml(html);

  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const elements = doc.body.querySelectorAll('*');

  for (const element of elements) {
    const tag = element.tagName?.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) {
      element.remove();
    } else {
      stripUnsafeAttributes(element);
    }
  }

  return doc.body.innerHTML;
}
