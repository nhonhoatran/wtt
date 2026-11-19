import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'] },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => {
      const rawHref = attribs.href;
      const href = rawHref && /^(https:|mailto:)/i.test(rawHref.trim()) ? rawHref.trim() : undefined;
      const blank = href && attribs.target === '_blank';
      return { tagName, attribs: { ...(href ? { href } : {}), ...(blank ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {}) } };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.src && /^https:/i.test(attribs.src.trim()) ? { src: attribs.src.trim() } : {}),
        ...(attribs.alt ? { alt: attribs.alt } : {}),
        ...(attribs.width && /^\d{1,5}$/.test(attribs.width) ? { width: attribs.width } : {}),
        ...(attribs.height && /^\d{1,5}$/.test(attribs.height) ? { height: attribs.height } : {}),
      },
    }),
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
};

/** Reapplies the Phase 04 rich-text allowlist at the final HTML rendering boundary. */
export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
