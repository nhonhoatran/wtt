import { DownOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Avatar, Button, Dropdown, Flex, Layout, Typography, theme } from 'antd';
import { useNavigate } from 'react-router';
import type { CurrentUser } from '../providers/current-user';
import { AdminBreadcrumb } from './admin-breadcrumb';
import { ROLE_LABELS, type MenuGroupDef } from './menu-groups';

const INITIALS_MAX = 2;

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(-INITIALS_MAX).map((word) => word[0]?.toUpperCase() ?? '').join('');
}

interface AdminHeaderProps {
  user: CurrentUser;
  groups: MenuGroupDef[];
  homeTitle: string;
  compact: boolean;
  onOpenMenu: () => void;
  onLogout: () => void;
}

export function AdminHeader({ user, groups, homeTitle, compact, onOpenMenu, onLogout }: AdminHeaderProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  return (
    <Layout.Header
      style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, position: 'sticky', top: 0, zIndex: 10, lineHeight: 'normal' }}
    >
      <Flex justify="space-between" align="center" gap={token.margin} style={{ height: '100%' }}>
        <Flex align="center" gap={token.marginXS} style={{ minWidth: 0 }}>
          {compact && <Button type="text" aria-label="Mở menu" icon={<MenuOutlined />} onClick={onOpenMenu} />}
          <AdminBreadcrumb groups={groups} homeTitle={homeTitle} />
        </Flex>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'password', label: 'Đổi mật khẩu', onClick: () => navigate('/change-password') },
              { key: 'logout', label: 'Đăng xuất', icon: <LogoutOutlined />, onClick: onLogout },
            ],
          }}
        >
          <Button type="text" aria-label={`Tài khoản ${user.name}`} style={{ height: 'auto', paddingBlock: token.paddingXXS }}>
            <Flex align="center" gap={token.marginXS}>
              <Avatar style={{ background: token.colorFillSecondary, color: token.colorText, fontWeight: 600 }}>{initialsOf(user.name)}</Avatar>
              {!compact && (
                <Flex vertical align="flex-start" style={{ lineHeight: 1.25 }}>
                  <Typography.Text strong>{user.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{ROLE_LABELS[user.role]}</Typography.Text>
                </Flex>
              )}
              <DownOutlined style={{ fontSize: token.fontSizeSM }} />
            </Flex>
          </Button>
        </Dropdown>
      </Flex>
    </Layout.Header>
  );
}
