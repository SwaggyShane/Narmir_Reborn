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
    const value = String(attr.value || '').trim();

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (name === 'href' || name === 'src' || name === 'xlink:href') {
      const lowerValue = value.toLowerCase();
      let isDangerous = false;

      for (const protocol of DANGEROUS_PROTOCOLS) {
        if (lowerValue.startsWith(protocol)) {
          isDangerous = true;
          break;
        }
      }

      if (isDangerous) {
        element.removeAttribute(attr.name);
      }
    }
  }
}

export function sanitizeHtml(html) {
  if (html == null || html === '') return '';
  if (typeof document === 'undefined') return String(html);

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