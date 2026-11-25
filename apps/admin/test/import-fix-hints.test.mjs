import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importFixHint } from '../src/resources/imports/import-fix-hints.ts';

test('known validation messages get a fix hint', () => {
  assert.match(importFixHint('Mã nội dung "XX" không có trong giải này'), /mã nội dung/);
  assert.match(importFixHint('VĐV 1: Không có VĐV mã KMT999'), /mã VĐV/);
  assert.match(importFixHint('Hạt giống 3 trùng với dòng 5'), /Xóa hoặc sửa/);
  assert.match(importFixHint('Hạt giống 2 đã có người trong nội dung MS'), /hạt giống khác/);
});

test('commit-step duplicate-row message gets the duplicate hint', () => {
  assert.match(importFixHint('Trùng với một dòng khác trong file (cùng nội dung, cùng VĐV)'), /Xóa hoặc sửa/);
});

test('unknown messages get no hint', () => {
  assert.equal(importFixHint('Lỗi lạ'), undefined);
});
