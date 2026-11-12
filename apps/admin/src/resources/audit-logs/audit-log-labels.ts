/** Display names for audit actions; unknown actions show their raw code. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
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
