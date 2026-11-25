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
  'articles.titles.list': 'Danh sách bài viết',
  'articles.titles.create': 'Thêm bài viết',
  'articles.titles.edit': 'Sửa bài viết',
  'articles.titles.show': 'Chi tiết bài viết',
  'videos.titles.list': 'Danh sách video',
  'videos.titles.create': 'Thêm video',
  'videos.titles.edit': 'Sửa video',
  'videos.titles.show': 'Chi tiết video',
  'static-pages.titles.list': 'Danh sách trang tĩnh',
  'static-pages.titles.create': 'Thêm trang tĩnh',
  'static-pages.titles.edit': 'Sửa trang tĩnh',
  'static-pages.titles.show': 'Chi tiết trang tĩnh',
  'contact-messages.titles.list': 'Hộp thư liên hệ',
  'contact-messages.titles.create': 'Thêm liên hệ',
  'contact-messages.titles.edit': 'Sửa liên hệ',
  'contact-messages.titles.show': 'Chi tiết liên hệ',
  'sponsors.titles.list': 'Danh sách nhà tài trợ',
  'sponsors.titles.create': 'Thêm nhà tài trợ',
  'sponsors.titles.edit': 'Sửa nhà tài trợ',
  'sponsors.titles.show': 'Chi tiết nhà tài trợ',
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
