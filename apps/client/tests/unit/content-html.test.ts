import { describe, expect, it } from 'vitest';
import { sanitizeContentHtml } from '../../src/lib/content-html';

describe('sanitizeContentHtml', () => {
  it('keeps allowed text formatting and https links', () => {
    expect(sanitizeContentHtml('<h2>News</h2><p><a href="https://example.com">Read</a></p>')).toBe(
      '<h2>News</h2><p><a href="https://example.com">Read</a></p>',
    );
  });

  it('strips executable content and unsafe embeds at render time', () => {
    const clean = sanitizeContentHtml('<script>alert(1)</script><p onclick="x()">Safe</p><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">link</a>');
    expect(clean).toBe('<p>Safe</p><a>link</a>');
  });
});
