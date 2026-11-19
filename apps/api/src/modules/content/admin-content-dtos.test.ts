import { describe, expect, it } from 'vitest';
import { staticPageBody, updateSponsorBody, videoBody } from './admin-content-dtos.js';

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
