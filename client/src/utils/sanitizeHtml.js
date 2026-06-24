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
]);

function stripUnsafeAttributes(element) {
  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase();
    const value = String(attr.value || '').trim().toLowerCase();

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    if ((name === 'href' || name === 'src' || name === 'xlink:href') && value.startsWith('javascript:')) {
      element.removeAttribute(attr.name);
    }
  }
}

export function sanitizeHtml(html) {
  if (html == null || html === '') return '';
  if (typeof document === 'undefined') return String(html);

  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);

  let node = walker.currentNode;
  while (node) {
    const tag = node.tagName?.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) {
      node.remove();
    } else {
      stripUnsafeAttributes(node);
    }
    node = walker.nextNode();
  }

  return doc.body.innerHTML;
}