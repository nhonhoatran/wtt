import type { ThemeConfig } from 'antd';
import { tokens, type Tokens } from './tokens.js';

export function buildAntdTheme(source: Tokens = tokens): ThemeConfig {
  return {
    token: {
      colorPrimary: source.color.primary,
      colorLink: source.color.data,
      colorTextBase: source.color.ink,
      colorBorder: source.color.border,
      colorBgLayout: source.color.surfaceAlt,
      colorBgContainer: source.color.surface,
      fontFamily: source.font.family,
      borderRadius: source.radius.button,
      borderRadiusLG: source.radius.card,
    },
    components: {
      Layout: { headerBg: source.color.ink, siderBg: source.color.ink },
      // Dark menu sits on the sider; without this antd paints its own navy behind the items.
      Menu: { darkItemBg: source.color.ink, darkSubMenuItemBg: source.color.ink, darkPopupBg: source.color.ink },
    },
  };
}

export const antdTheme: ThemeConfig = buildAntdTheme();
