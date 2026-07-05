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
  'foreignObject', // SVG XSS vector
]);

const DANGEROUS_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
]);

function stripUnsafeAttributes(element) {
  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase();
    const rawValue = String(attr.value || '').trim();
    // Normalize: lower, remove whitespace, also decode some common entities for safety
    let normalizedValue = rawValue.toLowerCase().replace(/\s+/g, '');
    normalizedValue = normalizedValue.replace(/&#x3a;/g, ':').replace(/&#58;/g, ':'); // catch encoded :

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (name === 'style' || name === 'srcdoc') {
      element.removeAttribute(attr.name);
      continue;
    }

    // Block dangerous protocols in href/src and any URL-bearing attr (defense-in-depth)
    if (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action' || name === 'formaction') {
      for (const protocol of DANGEROUS_PROTOCOLS) {
        if (normalizedValue.startsWith(protocol) || normalizedValue.includes(protocol)) {
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
