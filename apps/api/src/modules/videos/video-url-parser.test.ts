import { describe, expect, it } from 'vitest';
import { parseVideoUrl } from './video-url-parser.js';

describe('parseVideoUrl', () => {
  it('parses supported YouTube URL forms', () => {
    expect(parseVideoUrl('https://youtu.be/Abcdef_1234')).toMatchObject({ provider: 'youtube', embedId: 'Abcdef_1234' });
    expect(parseVideoUrl('https://www.youtube.com/shorts/Abcdef_1234')).toMatchObject({ provider: 'youtube', embedId: 'Abcdef_1234' });
  });
  it('parses Facebook videos and rejects unsafe hosts and protocols', () => {
    expect(parseVideoUrl('https://www.facebook.com/watch?v=123456789012')).toMatchObject({ provider: 'facebook', embedId: '123456789012' });
    for (const value of ['http://youtube.com/watch?v=Abcdef_1234', 'https://youtube.com.evil.test/watch?v=Abcdef_1234', 'https://user@youtube.com/watch?v=Abcdef_1234', 'https://youtube.com:444/watch?v=Abcdef_1234']) expect(parseVideoUrl(value)).toBeNull();
  });
  it('honors the configured host allowlist without enabling unsupported providers', () => {
    expect(parseVideoUrl('https://youtu.be/Abcdef_1234', 'facebook.com')).toBeNull();
    expect(parseVideoUrl('https://www.youtube.com/watch?v=Abcdef_1234', 'www.youtube.com')).toMatchObject({ provider: 'youtube' });
    expect(parseVideoUrl('https://video.example/watch?v=Abcdef_1234', 'video.example')).toBeNull();
  });
});
