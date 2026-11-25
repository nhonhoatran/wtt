import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventStatusPills } from '../../src/components/events/event-status-pills';
import { PaginationLinks } from '../../src/components/common/pagination-links';
import { getDictionary } from '../../src/i18n/get-dictionary';

const t = getDictionary('vi');
const en = getDictionary('en');

describe('PaginationLinks range line', () => {
  const render = (page: number, dict = t) =>
    renderToStaticMarkup(createElement(PaginationLinks, { page, pageSize: 5, total: 12, hrefFor: (p) => `/e?page=${p}`, t: dict.common }));

  it('names the shown slice and the total', () => {
    expect(render(1)).toContain('Hiển thị 1–5 trong 12 kết quả');
    expect(render(3)).toContain('Hiển thị 11–12 trong 12 kết quả');
    expect(render(2, en)).toContain('Showing 6–10 of 12 results');
  });

  it('renders nothing for a single page', () => {
    expect(renderToStaticMarkup(createElement(PaginationLinks, { page: 1, pageSize: 5, total: 3, hrefFor: () => '/', t: t.common }))).toBe('');
  });
});

describe('EventStatusPills', () => {
  const render = (filters: string, status: string) =>
    renderToStaticMarkup(createElement(EventStatusPills, { base: '/vi/events', filters, status, t }));

  it('keeps the other filters, drops the page and the old status', () => {
    const html = render('?q=open&year=2027&status=ongoing', 'ongoing');
    expect(html).toContain('href="/vi/events?q=open&amp;year=2027"');
    expect(html).toContain('href="/vi/events?q=open&amp;year=2027&amp;status=upcoming"');
    expect(html).not.toContain('page=');
  });

  it('marks only the chosen status as current', () => {
    const html = render('?status=completed', 'completed');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*>Đã kết thúc</);
  });
});
