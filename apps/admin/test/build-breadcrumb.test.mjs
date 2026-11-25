import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBreadcrumb, findMenuEntry } from '../src/layout/build-breadcrumb.ts';

const groups = [
  { label: 'Giải đấu', items: [{ label: 'Giải đấu', path: '/events' }, { label: 'Nhập tỷ số', path: '/results' }] },
  { label: 'Xếp hạng', items: [{ label: 'Kỳ chốt', path: '/ranking-snapshots' }, { label: 'Bảng xếp hạng', path: '/ranking-lists' }] },
  { label: 'Cấu hình', items: [{ label: 'Cài đặt hệ thống', path: '/settings' }, { label: 'Hàng đợi', path: '/api/v1/admin/queues', external: true }] },
];
const options = { homeTitle: 'Tổng quan', rootTitle: 'Trang chủ', actionTitles: { create: 'Tạo mới', edit: 'Chỉnh sửa' } };

test('home shows root and the landing title', () => {
  assert.deepEqual(buildBreadcrumb('/', groups, options), [{ title: 'Trang chủ', path: '/' }, { title: 'Tổng quan' }]);
});

test('list page drops the group when it repeats the item label', () => {
  assert.deepEqual(buildBreadcrumb('/events', groups, options), [{ title: 'Trang chủ', path: '/' }, { title: 'Giải đấu' }]);
});

test('list page keeps a different group label as plain text', () => {
  assert.deepEqual(buildBreadcrumb('/settings', groups, options), [{ title: 'Trang chủ', path: '/' }, { title: 'Cấu hình' }, { title: 'Cài đặt hệ thống' }]);
});

test('detail page appends the tail and links back to the list', () => {
  assert.deepEqual(buildBreadcrumb('/events/abc/entries', groups, { ...options, tail: 'Kamito Open' }), [
    { title: 'Trang chủ', path: '/' },
    { title: 'Giải đấu', path: '/events' },
    { title: 'Kamito Open' },
  ]);
});

test('create and edit routes get an action crumb', () => {
  assert.equal(buildBreadcrumb('/events/create', groups, options).at(-1)?.title, 'Tạo mới');
  assert.equal(buildBreadcrumb('/events/abc/edit', groups, options).at(-1)?.title, 'Chỉnh sửa');
});

test('nested route without a tail still links back to its list', () => {
  const crumbs = buildBreadcrumb('/ranking-snapshots/s1', groups, options);
  assert.deepEqual(crumbs.at(-1), { title: 'Kỳ chốt', path: '/ranking-snapshots' });
});

test('unknown path falls back to the root crumb only', () => {
  assert.deepEqual(buildBreadcrumb('/nowhere', groups, options), [{ title: 'Trang chủ', path: '/' }]);
});

test('prefix lookalikes and external items never match', () => {
  assert.equal(findMenuEntry('/events-archive', groups), undefined);
  assert.equal(findMenuEntry('/api/v1/admin/queues', groups), undefined);
  assert.equal(findMenuEntry('/ranking-lists/x', groups)?.item.path, '/ranking-lists');
});
