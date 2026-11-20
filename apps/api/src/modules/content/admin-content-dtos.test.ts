import { describe, expect, it } from 'vitest';
import { articleBody, staticPageBody, updateSponsorBody, videoBody } from './admin-content-dtos.js';

describe('immediate content status', () => {
  it('rejects scheduled videos because video publishing has no delayed job', () => {
    expect(videoBody.safeParse({ slug: 'final-match', title: 'Final match', url: 'https://youtu.be/Abcdef_1234', status: 'SCHEDULED' }).success).toBe(false);
  });

  it('rejects scheduled static pages because page publishing has no delayed job', () => {
    expect(staticPageBody.safeParse({ slug: 'about', title: 'About', body: '<p>About us</p>', status: 'SCHEDULED' }).success).toBe(false);
  });
});

it('lets the event hub reorder a sponsor without changing any other fields', () => {
  expect(updateSponsorBody.parse({ order: 3 })).toEqual({ order: 3 });
});

it('accepts optional English labels and keeps untranslated legacy payloads valid', () => {
  const article = { slug: 'news', title: 'Tin', body: '<p>Tin</p>' };
  const video = { slug: 'final', title: 'Chung kết', url: 'https://youtu.be/Abcdef_1234' };
  const page = { slug: 'about', title: 'Giới thiệu', body: '<p>Giới thiệu</p>' };
  expect(articleBody.parse({ ...article, categoryEn: 'News' }).categoryEn).toBe('News');
  expect(videoBody.parse({ ...video, durationTextEn: '4 minutes' }).durationTextEn).toBe('4 minutes');
  expect(staticPageBody.parse({ ...page, footerGroupEn: 'Information' }).footerGroupEn).toBe('Information');
  expect(articleBody.parse(article).categoryEn).toBeUndefined();
  expect(videoBody.parse(video).durationTextEn).toBeUndefined();
  expect(staticPageBody.parse(page).footerGroupEn).toBeUndefined();
  expect(articleBody.parse({ ...article, categoryEn: null }).categoryEn).toBeNull();
});
