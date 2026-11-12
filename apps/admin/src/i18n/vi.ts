import type { I18nProvider } from '@refinedev/core';

/** Vietnamese labels for the texts Refine and @refinedev/antd render themselves. */
export const vi: Record<string, string> = {
  'buttons.create': 'Thêm',
  'buttons.save': 'Lưu',
  'buttons.edit': 'Sửa',
  'buttons.delete': 'Xóa',
  'buttons.cancel': 'Hủy',
  'buttons.confirm': 'Bạn chắc chứ?',
  'buttons.filter': 'Lọc',
  'buttons.clear': 'Xóa lọc',
  'buttons.refresh': 'Tải lại',
  'buttons.show': 'Xem',
  'buttons.list': 'Danh sách',
  'buttons.logout': 'Đăng xuất',
  'buttons.notAccessTitle': 'Bạn không có quyền này',
  'actions.list': 'Danh sách',
  'actions.create': 'Thêm mới',
  'actions.edit': 'Sửa',
  'actions.show': 'Chi tiết',
  'table.actions': 'Thao tác',
  'notifications.success': 'Thành công',
  'notifications.error': 'Lỗi (mã {{statusCode}})',
  'notifications.createSuccess': 'Đã tạo {{resource}}',
  'notifications.createError': 'Không tạo được {{resource}} (mã {{statusCode}})',
  'notifications.editSuccess': 'Đã lưu {{resource}}',
  'notifications.editError': 'Không lưu được {{resource}} (mã {{statusCode}})',
  'notifications.deleteSuccess': 'Đã xóa {{resource}}',
  'notifications.deleteError': 'Không xóa được {{resource}} (mã {{statusCode}})',
  'notifications.undoable': 'Bạn có {{seconds}} giây để hoàn tác',
  warnWhenUnsavedChanges: 'Bạn có thay đổi chưa lưu. Rời trang?',
  'pages.error.404': 'Không tìm thấy trang này.',
  'pages.error.backHome': 'Về trang chủ',
};

function interpolate(text: string, options: unknown): string {
  if (!options || typeof options !== 'object') return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String((options as Record<string, unknown>)[key] ?? ''));
}

export const i18nProvider: I18nProvider = {
  translate: (key, options, defaultMessage) => interpolate(vi[key] ?? defaultMessage ?? key, options),
  changeLocale: async () => undefined,
  getLocale: () => 'vi',
};
