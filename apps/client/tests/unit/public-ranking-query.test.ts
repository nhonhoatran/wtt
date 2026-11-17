import { expect, it } from 'vitest';
import { PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';
import { anyText, isPageParam, oneOf, toQuery } from '../../src/lib/public-query';

it('bounds arbitrary URL searches while preserving accepted club and page values', () => {
  const q = 'N'.repeat(PUBLIC_SEARCH_MAX_LENGTH + 80);
  const query = new URLSearchParams(toQuery({ q, club: 'Câu lạc bộ', page: '2' }, { q: anyText, club: oneOf(['Câu lạc bộ']), page: isPageParam }));
  expect(query.get('q')).toHaveLength(PUBLIC_SEARCH_MAX_LENGTH);
  expect(query.get('club')).toBe('Câu lạc bộ');
  expect(query.get('page')).toBe('2');
});

it('ignores repeated search values, unknown clubs and unsafe pages before fetching', () => {
  expect(toQuery({ q: ['Nguyễn', 'Văn'], club: 'unknown', page: '../2' }, { q: anyText, club: oneOf(['CLB']), page: isPageParam })).toBe('');
});
