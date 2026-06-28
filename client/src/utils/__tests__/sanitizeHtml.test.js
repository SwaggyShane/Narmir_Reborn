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

  it('escapes content when the DOM is unavailable', () => {
    vi.stubGlobal('document', undefined);

    const output = sanitizeHtml('<strong>unsafe & raw</strong>');

    expect(output).toBe('&lt;strong&gt;unsafe &amp; raw&lt;/strong&gt;');
  });
});
