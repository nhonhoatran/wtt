import { DashboardOutlined } from '@ant-design/icons';
import { appSettingRegistry } from '@kamito/shared';
import { tokens } from '@kamito/ui-tokens';
import { buildSiderTheme } from '@kamito/ui-tokens/antd-theme';
import { useGetIdentity } from '@refinedev/core';
import { ConfigProvider, Flex, Menu, Typography, type MenuProps } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { CurrentUser } from '../providers/current-user';
import { findMenuEntry } from './build-breadcrumb';
import { SHELL_LABELS, type MenuGroupDef, type MenuItemDef } from './menu-groups';

export const SIDER_WIDTH = 240;
const OVERVIEW_KEY = '/';
const EXTERNAL_PREFIX = 'external:';
const RESULTS_ITEM_KEY = 'results';
const BRAND_TAGLINE = 'Quản trị giải đấu';
const BRAND_MARK_SIZE = 36;

type MenuEntry = NonNullable<MenuProps['items']>[number];

const itemKey = (item: MenuItemDef) => (item.external ? `${EXTERNAL_PREFIX}${item.path}` : item.path);
const toLeaf = (item: MenuItemDef): MenuEntry => ({ key: itemKey(item), label: item.label, icon: <item.icon /> });

function buildMainItems(groups: MenuGroupDef[], showOverview: boolean): MenuEntry[] {
  const overview: MenuEntry[] = showOverview ? [{ key: OVERVIEW_KEY, label: SHELL_LABELS.overview, icon: <DashboardOutlined /> }] : [];
  const sections = groups.map((group) => ({
    key: group.key,
    type: 'group' as const,
    label: <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{group.label}</span>,
    children: group.items.map(toLeaf),
  }));
  return [...overview, ...sections];
}

function buildBottomItems(groups: MenuGroupDef[]): MenuEntry[] {
  return groups.map((group) =>
    group.items.length === 1 && group.items[0]
      ? toLeaf(group.items[0])
      : { key: `group:${group.key}`, label: group.label, icon: <group.icon />, children: group.items.map(toLeaf) },
  );
}

/** The results operator lands on `/` with the results-entry screen, so its menu item stays highlighted there. */
const resultsHomeKey = (groups: MenuGroupDef[]) => {
  const item = groups.flatMap((g) => g.items).find((i) => i.key === RESULTS_ITEM_KEY);
  return item ? itemKey(item) : undefined;
};

interface AdminSiderProps {
  groups: MenuGroupDef[];
  showOverview: boolean;
  onNavigate: () => void;
}

export function AdminSider({ groups, showOverview, onNavigate }: AdminSiderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const brandName = useGetIdentity<CurrentUser>().data?.siteName?.vi ?? appSettingRegistry.siteName.defaultValue.vi;
  const match = findMenuEntry(pathname, groups);
  const selected = match ? itemKey(match.item) : pathname === OVERVIEW_KEY ? (showOverview ? OVERVIEW_KEY : resultsHomeKey(groups)) : undefined;
  const activeSubmenu = match && match.group.placement === 'bottom' && match.group.items.length > 1 ? `group:${match.group.key}` : undefined;
  const [openKeys, setOpenKeys] = useState<string[]>(activeSubmenu ? [activeSubmenu] : []);
  const [seenSubmenu, setSeenSubmenu] = useState(activeSubmenu);
  // Open the submenu of a newly selected entry without overriding later manual toggles.
  if (activeSubmenu !== seenSubmenu) {
    setSeenSubmenu(activeSubmenu);
    if (activeSubmenu && !openKeys.includes(activeSubmenu)) setOpenKeys([...openKeys, activeSubmenu]);
  }

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith(EXTERNAL_PREFIX)) window.open(key.slice(EXTERNAL_PREFIX.length), '_blank', 'noopener');
    else navigate(key);
    onNavigate();
  };
  const common: MenuProps = { theme: 'dark', mode: 'inline', selectedKeys: selected ? [selected] : [], onClick };

  return (
    <ConfigProvider theme={buildSiderTheme()}>
      <Flex vertical style={{ minHeight: '100%' }}>
        <Flex align="center" gap={12} style={{ padding: 16 }}>
          <Flex
            align="center"
            justify="center"
            aria-hidden
            style={{ width: BRAND_MARK_SIZE, height: BRAND_MARK_SIZE, borderRadius: tokens.radius.card, background: tokens.color.primary, color: tokens.color.surface, fontWeight: 800 }}
          >
            {Array.from(brandName)[0]?.toUpperCase()}
          </Flex>
          <Flex vertical>
            <Typography.Text strong style={{ color: tokens.color.surface, lineHeight: 1.2 }}>{brandName}</Typography.Text>
            <Typography.Text style={{ color: tokens.color.lineStrong, fontSize: 12 }}>{BRAND_TAGLINE}</Typography.Text>
          </Flex>
        </Flex>
        <Menu {...common} style={{ borderInlineEnd: 0 }} items={buildMainItems(groups.filter((g) => g.placement === 'main'), showOverview)} />
        <div style={{ flex: 1 }} />
        <Menu
          {...common}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={buildBottomItems(groups.filter((g) => g.placement === 'bottom'))}
          style={{ borderInlineEnd: 0, borderTop: `1px solid ${tokens.color.textMuted}`, marginTop: 16, paddingBlock: 8 }}
        />
      </Flex>
    </ConfigProvider>
  );
}
