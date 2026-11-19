import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireClipboardImage, requireSecureRichTextImageUrl, validateClipboardImageConfig } from '../src/components/rich-text-image-policy.ts';

test('inline image URLs require public HTTPS without credentials or relative-origin guessing', () => {
  assert.equal(requireSecureRichTextImageUrl('https://cdn.example.test/media/public/article-body/image.webp'), 'https://cdn.example.test/media/public/article-body/image.webp');
  for (const url of [null, '/api/v1/media/public/image.webp', '//cdn.example.test/image.webp', 'http://localhost:3000/image.webp', 'data:image/png;base64,aA==', 'javascript:alert(1)', 'https://user:password@cdn.example.test/image.webp']) {
    assert.throws(() => requireSecureRichTextImageUrl(url), /MEDIA_PUBLIC_BASE_URL/);
  }
});

test('clipboard SVG and empty or non-image files are refused before upload', () => {
  for (const file of [{ type: 'image/svg+xml', size: 80 }, { type: 'text/html', size: 80 }, { type: 'image/png', size: 0 }]) {
    assert.throws(() => requireClipboardImage(file));
  }
  assert.equal(requireClipboardImage({ type: 'IMAGE/PNG', size: 80 }), 'image/png');
});

test('configured MIME allowlist and byte cap constrain clipboard image uploads', () => {
  const config = { allowedTypes: ['image/png'], maxBytes: 100 };
  assert.doesNotThrow(() => validateClipboardImageConfig('image/png', 100, config));
  assert.throws(() => validateClipboardImageConfig('image/png', 101, config));
  assert.throws(() => validateClipboardImageConfig('image/jpeg', 50, config));
});
