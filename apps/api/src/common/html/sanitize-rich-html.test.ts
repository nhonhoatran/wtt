import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml, sanitizeRichHtmlOrNull } from './sanitize-rich-html.js';

const FORBIDDEN = /<\s*(script|iframe|svg|math|object|embed|form|style)|\son\w+\s*=|javascript:|data:|srcdoc|style\s*=/i;

describe('sanitizeRichHtml', () => {
  it('keeps allowed formatting', () => {
    const html = '<h2>Title</h2><p>a <strong>b</strong> <em>c</em></p><ul><li>x</li></ul><table><tbody><tr><td>1</td></tr></tbody></table>';
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  it.each([
    ['script tag', '<p>hi</p><script>alert(1)</script>'],
    ['img onerror', '<img src="https://x.test/a.png" onerror="alert(1)">'],
    ['img onerror broken src', '<img src=x onerror=alert(1)>'],
    ['javascript href', '<a href="javascript:alert(1)">x</a>'],
    ['mixed-case javascript', '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['entity-encoded javascript', '<a href="&#106;avascript:alert(1)">x</a>'],
    ['hex entity javascript', '<a href="&#x6A;avascript:alert(1)">x</a>'],
    ['tab inside scheme', '<a href="java&#9;script:alert(1)">x</a>'],
    ['padded javascript href', '<a href="  javascript:alert(1)">x</a>'],
    ['data url link', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'],
    ['data url image', '<img src="data:image/svg+xml;base64,PHN2Zz4=">'],
    ['iframe', '<iframe src="https://evil.test"></iframe>'],
    ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
    ['svg onload', '<svg onload="alert(1)"><circle/></svg>'],
    ['math', '<math><mi xlink:href="javascript:alert(1)">x</mi></math>'],
    ['style attribute', '<p style="background:url(javascript:alert(1))">x</p>'],
    ['style tag', '<style>body{background:url(javascript:alert(1))}</style><p>x</p>'],
    ['object and embed', '<object data="x.swf"></object><embed src="x.swf">'],
    ['form', '<form action="https://evil.test"><input name="a"></form>'],
    ['nested malformed', '<scr<script>ipt>alert(1)</scr</script>ipt>'],
    ['unclosed tags', '<a href="javascript:alert(1)"><img src=x onerror=alert(1)'],
    ['protocol relative image', '<img src="//evil.test/a.png">'],
  ])('neutralises %s', (_name, payload) => {
    expect(sanitizeRichHtml(payload)).not.toMatch(FORBIDDEN);
  });

  it('drops links and images whose scheme is not allowed but keeps the text', () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>');
    expect(sanitizeRichHtml('<img src="http://x.test/a.png">')).toBe('');
    expect(sanitizeRichHtml('<img src="/relative.png">')).toBe('');
  });

  it('allows https and mailto links and https images', () => {
    expect(sanitizeRichHtml('<a href="https://x.test/p?a=1&amp;b=2">x</a>')).toBe('<a href="https://x.test/p?a=1&amp;b=2">x</a>');
    expect(sanitizeRichHtml('<a href="mailto:a@x.test">m</a>')).toContain('href="mailto:a@x.test"');
    expect(sanitizeRichHtml('<img src="https://x.test/a.png" alt="A" width="10" height="20">')).toBe(
      '<img src="https://x.test/a.png" alt="A" width="10" height="20" />',
    );
  });

  it('forces a safe rel on target=_blank links and removes other targets', () => {
    const blank = sanitizeRichHtml('<a href="https://x.test" target="_blank" rel="opener">x</a>');
    expect(blank).toContain('target="_blank"');
    expect(blank).toContain('rel="noopener noreferrer nofollow"');
    expect(sanitizeRichHtml('<a href="https://x.test" target="_top">x</a>')).toBe('<a href="https://x.test">x</a>');
  });

  it('drops non-numeric image dimensions and class attributes', () => {
    const out = sanitizeRichHtml('<p class="x"><img src="https://x.test/a.png" width="100%" height="1e9" class="y"></p>');
    expect(out).not.toMatch(/class|width|height/);
  });
});

describe('sanitizeRichHtmlOrNull', () => {
  it('maps blank and fully stripped input to null', () => {
    expect(sanitizeRichHtmlOrNull(null)).toBeNull();
    expect(sanitizeRichHtmlOrNull('   ')).toBeNull();
    expect(sanitizeRichHtmlOrNull('<script>alert(1)</script>')).toBeNull();
    expect(sanitizeRichHtmlOrNull('<p></p>')).toBeNull();
  });

  it('keeps real content', () => {
    expect(sanitizeRichHtmlOrNull('<p>Hello</p><script>x</script>')).toBe('<p>Hello</p>');
  });
});
