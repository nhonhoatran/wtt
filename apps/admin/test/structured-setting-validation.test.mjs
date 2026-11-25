import assert from 'node:assert/strict';
import { test } from 'node:test';
import { socialLinkError, validateBilingual, validateNavItems, validateSocialLinks } from '../src/pages/settings-editors/structured-setting-validation.ts';

const navRules = { options: [{ value: 'news', label: 'Tin tức' }, { value: 'events', label: 'Giải đấu' }], maxItems: 3, maxLabelLength: 5 };
const socialRules = { platforms: [{ value: 'facebook', label: 'Facebook' }], maxItems: 2 };

test('bilingual: required name needs both languages', () => {
  const rules = { maxLength: 10, nullable: false, fieldName: 'tên site' };
  assert.equal(validateBilingual({ vi: 'Giải', en: 'Open' }, rules), null);
  assert.match(validateBilingual({ vi: 'Giải', en: ' ' }, rules), /tiếng Anh/);
  assert.match(validateBilingual({ vi: '', en: 'Open' }, rules), /tiếng Việt/);
  assert.match(validateBilingual(null, rules), /cả tiếng Việt và tiếng Anh/);
  assert.match(validateBilingual({ vi: 'x'.repeat(11), en: 'a' }, rules), /Tối đa 10 ký tự.*đang 11/);
});

test('bilingual: nullable text may be hidden, never half filled', () => {
  const rules = { maxLength: 10, nullable: true, fieldName: 'giới thiệu' };
  assert.equal(validateBilingual(null, rules), null);
  assert.equal(validateBilingual({ vi: '', en: '' }, rules), null);
  assert.match(validateBilingual({ vi: 'Xin chào', en: '' }, rules), /xóa cả hai ô để ẩn/);
});

test('nav items: size, duplicates and label length are reported with the item name', () => {
  assert.match(validateNavItems([], navRules), /ít nhất một mục/);
  assert.equal(validateNavItems([{ key: 'news' }, { key: 'events', labelVi: 'Giải' }], navRules), null);
  assert.match(validateNavItems([{ key: 'news' }, { key: 'news' }], navRules), /"Tin tức" xuất hiện hai lần/);
  assert.match(validateNavItems([{ key: 'news' }, { key: 'events' }, { key: 'a' }, { key: 'b' }], navRules), /tối đa 3 mục/);
  assert.match(validateNavItems([{ key: 'events', labelEn: 'Tournament' }], navRules), /Mục 1 \("Giải đấu"\).*tiếng Anh.*tối đa 5/);
});

test('social links: https only, row named in the message', () => {
  assert.equal(validateSocialLinks([], socialRules), null);
  assert.equal(validateSocialLinks([{ platform: 'facebook', url: 'https://facebook.com/kamito' }], socialRules), null);
  assert.match(validateSocialLinks([{ platform: 'facebook', url: '' }], socialRules), /Liên kết 1 \(Facebook\): chưa nhập/);
  assert.match(validateSocialLinks([{ platform: 'facebook', url: 'http://facebook.com/x' }], socialRules), /bắt đầu bằng https:\/\//);
  assert.match(validateSocialLinks([{ platform: 'facebook', url: 'javascript:alert(1)' }], socialRules), /https:\/\//);
  const three = Array.from({ length: 3 }, () => ({ platform: 'facebook', url: 'https://facebook.com/x' }));
  assert.match(validateSocialLinks(three, socialRules), /Tối đa 2 liên kết/);
  assert.equal(socialLinkError({ platform: 'facebook', url: 'https://facebook.com/x' }, 0, socialRules.platforms), null);
});
