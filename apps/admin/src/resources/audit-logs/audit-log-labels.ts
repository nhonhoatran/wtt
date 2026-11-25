const crudLabels = (prefix: string, noun: string): Record<string, string> => ({
  [`${prefix}.create`]: `Thêm ${noun}`,
  [`${prefix}.update`]: `Sửa ${noun}`,
  [`${prefix}.delete`]: `Xóa ${noun}`,
});

/** Display names for audit actions; unknown actions show their raw code. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ...crudLabels('event', 'giải đấu'),
  ...crudLabels('subEvent', 'nội dung thi đấu'),
  ...crudLabels('player', 'vận động viên'),
  ...crudLabels('session', 'buổi thi đấu'),
  ...crudLabels('article', 'bài viết'),
  ...crudLabels('video', 'video'),
  ...crudLabels('sponsor', 'nhà tài trợ'),
  ...crudLabels('staticPage', 'trang tĩnh'),
  ...crudLabels('venue', 'địa điểm'),
  ...crudLabels('venueTable', 'bàn thi đấu'),
  ...crudLabels('tier', 'hạng giải'),
  ...crudLabels('eventType', 'loại giải'),
  ...crudLabels('category', 'nhóm thi đấu'),
  ...crudLabels('discipline', 'nội dung chuẩn'),
  ...crudLabels('matchFormat', 'thể thức trận'),
  ...crudLabels('groupScoringRule', 'quy tắc tính điểm bảng'),
  ...crudLabels('ranking.list', 'bảng xếp hạng'),
  'entry.create': 'Thêm đăng ký thi đấu',
  'entry.update': 'Sửa đăng ký thi đấu',
  'entry.override': 'Duyệt ngoại lệ đăng ký',
  'draw.generate': 'Tạo bốc thăm',
  'draw.publish': 'Công bố bốc thăm',
  'draw.unpublish': 'Hủy công bố bốc thăm',
  'draw.swap': 'Đổi chỗ trên nhánh',
  'draw.swapGroupMembers': 'Đổi chỗ trong bảng',
  'draw.discard': 'Hủy bản bốc thăm nháp',
  'draw.delete': 'Xóa bốc thăm',
  'draw.placeQualifiers': 'Xếp người vượt vòng loại',
  'draw.placeGroupQualifiers': 'Xếp người đi tiếp từ bảng',
  'group.recompute': 'Tính lại bảng đấu',
  'group.manualRanks': 'Xếp hạng bảng thủ công',
  'round.matchFormat': 'Đổi thể thức vòng đấu',
  'match.schedule': 'Xếp lịch trận',
  'match.start': 'Bắt đầu trận',
  'match.unStart': 'Hủy bắt đầu trận',
  'match.saveProgress': 'Lưu tỷ số tạm',
  'match.confirm': 'Xác nhận kết quả',
  'match.amend': 'Sửa kết quả trận',
  'match.reopen': 'Mở lại trận',
  'match.forceReopen': 'Mở lại trận (bắt buộc)',
  'match.resetByReopen': 'Trận bị đặt lại do mở lại',
  'import.create': 'Tải file Excel lên',
  'import.commit.request': 'Xác nhận nhập Excel',
  'import.revalidate': 'Kiểm tra lại file Excel',
  'ranking.recompute': 'Tính lại bảng xếp hạng',
  'ranking.rules.save': 'Lưu quy tắc điểm',
  'ranking.points.manual.create': 'Thêm điểm thủ công',
  'ranking.points.manual.delete': 'Xóa điểm thủ công',
  'ranking.snapshot.publish': 'Chốt kỳ xếp hạng',
  'ranking.snapshot.delete': 'Xóa kỳ xếp hạng',
  'player.merge': 'Gộp hồ sơ vận động viên',
  'contactMessage.update': 'Xử lý tin nhắn liên hệ',
  'media.create': 'Tạo ảnh tải lên',
  'media.complete': 'Hoàn tất tải ảnh',
  'media.update': 'Sửa ảnh',
  'sponsor.reorder': 'Đổi thứ tự nhà tài trợ',
  'user.create': 'Tạo tài khoản',
  'user.update': 'Sửa tài khoản',
  'user.role.change': 'Đổi vai trò',
  'user.lock': 'Khóa tài khoản',
  'user.unlock': 'Mở khóa tài khoản',
  'user.password.reset': 'Cấp mật khẩu tạm',
  'user.sessions.revoke': 'Đăng xuất mọi thiết bị',
  'user.admin.create.cli': 'Tạo quản trị (dòng lệnh)',
  'user.admin.restore.cli': 'Khôi phục quản trị (dòng lệnh)',
  'auth.password.change': 'Đổi mật khẩu',
  'auth.step-up.failed': 'Nhập lại mật khẩu sai',
  'setting.update': 'Đổi cài đặt',
  'setting.reset': 'Khôi phục cài đặt mặc định',
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  User: 'Tài khoản',
  AppSetting: 'Cài đặt',
  Event: 'Giải đấu',
  Match: 'Trận đấu',
  Draw: 'Bốc thăm',
  Entry: 'Đăng ký thi đấu',
  Player: 'Vận động viên',
};

export const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export interface AuditLogRecord {
  id: string;
  actorType: 'USER' | 'SYSTEM';
  actorId: string;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  createdAt: string;
}
