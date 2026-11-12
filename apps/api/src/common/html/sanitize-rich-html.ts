import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
];
const LINK_URL = /^(https:|mailto:)/i;
const IMAGE_URL = /^https:/i;
const DIMENSION = /^\d{1,5}$/;

const keepIf = (value: string | undefined, pattern: RegExp): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && pattern.test(trimmed) ? trimmed : undefined;
};

function withOverrides(attribs: Record<string, string>, overrides: Record<string, string | undefined>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...attribs, ...overrides })) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => {
      const href = keepIf(attribs.href, LINK_URL);
      const blank = attribs.target === '_blank';
      return {
        tagName,
        attribs: withOverrides(attribs, {
          href,
          target: href && blank ? '_blank' : undefined,
          rel: href && blank ? 'noopener noreferrer nofollow' : undefined,
        }),
      };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: withOverrides(attribs, {
        src: keepIf(attribs.src, IMAGE_URL),
        width: keepIf(attribs.width, DIMENSION),
        height: keepIf(attribs.height, DIMENSION),
      }),
    }),
  },
  // An <img> without a usable https src is dropped entirely.
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
};

/** Allowlist sanitizer for admin-authored rich text; run on write and again on render. */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Sanitizes and maps blank or tag-only-empty output to null. */
export function sanitizeRichHtmlOrNull(html: string | null | undefined): string | null {
  if (!html) return null;
  const clean = sanitizeRichHtml(html);
  const hasContent = /<(img|hr|table)\b/i.test(clean) || sanitizeHtml(clean, { allowedTags: [] }).trim() !== '';
  return hasContent ? clean : null;
}
