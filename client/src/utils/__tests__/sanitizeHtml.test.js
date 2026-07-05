import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeHtml } from '../sanitizeHtml.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sanitizeHtml', () => {
  it('removes scriptable tags and event handlers', () => {
    const input = `
      <div onclick="alert(1)">
        <script>alert(1)</script>
        <a href="javascript:alert(2)">link</a>
        <img src="javascript:alert(3)" onerror="alert(4)" />
        <p>safe</p>
      </div>
    `;

    const output = sanitizeHtml(input);

    expect(output).toContain('<div>');
    expect(output).toContain('<p>safe</p>');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('onerror');
  });

  it('strips high-risk tags and attributes like svg, style, and srcdoc', () => {
    const input = `
      <div style="background:url(javascript:alert(1))">
        <svg><foreignObject><body onload="alert(1)"></body></foreignObject></svg>
        <iframe srcdoc="<script>alert(1)</script>"></iframe>
      </div>
    `;

    const output = sanitizeHtml(input);

    expect(output).toContain('<div>');
    expect(output).not.toContain('<svg');
    expect(output).not.toContain('style=');
    expect(output).not.toContain('srcdoc');
  });

  it('blocks data: vbscript: and case-variant dangerous protocols (XSS gaps closed)', () => {
    const input = `
      <a href="DATA:text/html,<script>alert(1)</script>">bad</a>
      <a href="VbScript:msgbox(1)">bad2</a>
      <img src=" data: image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+ " />
      <a href="javascript:alert(1)">js</a>
    `;

    const output = sanitizeHtml(input);

    expect(output).toContain('<a>bad</a>'); // href stripped, tag kept (text content preserved)
    expect(output).not.toContain('DATA:');
    expect(output).not.toContain('VbScript:');
    expect(output).not.toContain('data:');
    expect(output).not.toContain('javascript:');
    // src attr stripped for img but tag may remain (harmless); verify no dangerous payload leaked
    expect(output).not.toContain('image/svg+xml');
  });

  it('escapes content when the DOM is unavailable', () => {
    vi.stubGlobal('document', undefined);

    const output = sanitizeHtml('<strong>unsafe & raw</strong>');

    expect(output).toBe('&lt;strong&gt;unsafe &amp; raw&lt;/strong&gt;');
  });
});
