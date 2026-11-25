import { isHttpsUrl } from '@kamito/shared';

export interface BilingualValue {
  vi: string;
  en: string;
}

export interface NavItemValue {
  key: string;
  labelVi?: string;
  labelEn?: string;
}

export interface SocialLinkValue {
  platform: string;
  url: string;
}

const nameOf = (options: { value: string; label: string }[], value: string) => options.find((option) => option.value === value)?.label ?? value;

/** Both languages filled; a nullable value (null) is the "hidden" state. */
export function validateBilingual(value: BilingualValue | null | undefined, rules: { maxLength: number; nullable: boolean; fieldName: string }): string | null {
  const { maxLength, nullable, fieldName } = rules;
  if (value === null || value === undefined) return nullable ? null : `Nhập ${fieldName} bằng cả tiếng Việt và tiếng Anh.`;
  const vi = value.vi.trim();
  const en = value.en.trim();
  if (!vi && !en) return nullable ? null : `Nhập ${fieldName} bằng cả tiếng Việt và tiếng Anh.`;
  if (!vi) return `Thiếu bản tiếng Việt: nhập ${fieldName} tiếng Việt${nullable ? ', hoặc xóa cả hai ô để ẩn' : ''}.`;
  if (!en) return `Thiếu bản tiếng Anh: nhập ${fieldName} tiếng Anh${nullable ? ', hoặc xóa cả hai ô để ẩn' : ''}.`;
  const longest = Math.max(vi.length, en.length);
  if (longest > maxLength) return `Tối đa ${maxLength} ký tự mỗi ngôn ngữ (đang ${longest}). Hãy rút gọn bớt.`;
  return null;
}

export function validateNavItems(
  items: NavItemValue[] | undefined,
  rules: { options: { value: string; label: string }[]; maxItems: number; maxLabelLength: number },
): string | null {
  const list = items ?? [];
  if (list.length === 0) return 'Menu cần ít nhất một mục. Bấm "Thêm mục" để chọn.';
  if (list.length > rules.maxItems) return `Menu tối đa ${rules.maxItems} mục. Hãy bỏ bớt ${list.length - rules.maxItems} mục.`;
  const seen = new Set<string>();
  for (const [index, item] of list.entries()) {
    const name = nameOf(rules.options, item.key);
    if (seen.has(item.key)) return `Mục "${name}" xuất hiện hai lần. Mỗi mục chỉ được dùng một lần, hãy xóa bớt.`;
    seen.add(item.key);
    for (const [label, lang] of [[item.labelVi, 'tiếng Việt'], [item.labelEn, 'tiếng Anh']] as const) {
      if (label && label.trim().length > rules.maxLabelLength) {
        return `Mục ${index + 1} ("${name}"): nhãn ${lang} tối đa ${rules.maxLabelLength} ký tự (đang ${label.trim().length}).`;
      }
    }
  }
  return null;
}

export function socialLinkError(link: SocialLinkValue, index: number, platforms: { value: string; label: string }[]): string | null {
  const name = nameOf(platforms, link.platform);
  const url = link.url.trim();
  if (!url) return `Liên kết ${index + 1} (${name}): chưa nhập đường dẫn. Dán địa chỉ trang, ví dụ https://facebook.com/ten-trang.`;
  if (!isHttpsUrl(url)) return `Liên kết ${index + 1} (${name}): đường dẫn phải bắt đầu bằng https:// và không có khoảng trắng.`;
  return null;
}

export function validateSocialLinks(links: SocialLinkValue[] | undefined, rules: { platforms: { value: string; label: string }[]; maxItems: number }): string | null {
  const list = links ?? [];
  if (list.length > rules.maxItems) return `Tối đa ${rules.maxItems} liên kết. Hãy xóa bớt ${list.length - rules.maxItems} liên kết.`;
  for (const [index, link] of list.entries()) {
    const error = socialLinkError(link, index, rules.platforms);
    if (error) return error;
  }
  return null;
}
