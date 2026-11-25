import type { ThemeConfig } from 'antd';
import { tokens, type Tokens } from './tokens.js';

const FOCUS_RING_WIDTH = 2;
const FOCUS_SHADOW_ALPHA = 0.16;
const HEADER_HEIGHT = 56;

const withAlpha = (hex: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function buildAntdTheme(source: Tokens = tokens): ThemeConfig {
  // Focus uses navy like the public site, so red stays reserved for primary actions and errors.
  const focus = source.color.data;
  const focusShadow = withAlpha(focus, FOCUS_SHADOW_ALPHA);
  const focusedField = { activeBorderColor: focus, hoverBorderColor: focus, activeShadow: `0 0 0 ${FOCUS_RING_WIDTH}px ${focusShadow}` };
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
      // antd draws every keyboard focus outline with colorPrimaryBorder and field focus shadows with controlOutline.
      colorPrimaryBorder: focus,
      controlOutline: focusShadow,
      lineWidthFocus: FOCUS_RING_WIDTH,
    },
    components: {
      Layout: { headerBg: source.color.surface, headerColor: source.color.ink, headerHeight: HEADER_HEIGHT, headerPadding: `0 ${source.layout.gutterMobile}px`, siderBg: source.color.ink },
      // Dark menu sits on the sider; without this antd paints its own navy behind the items.
      Menu: {
        darkItemBg: source.color.ink,
        darkSubMenuItemBg: source.color.ink,
        darkPopupBg: source.color.ink,
        darkItemSelectedBg: source.color.primaryStrong,
        darkGroupTitleColor: source.color.lineStrong,
        itemBorderRadius: source.radius.card,
      },
      Input: focusedField,
      InputNumber: focusedField,
      DatePicker: focusedField,
      Select: { activeBorderColor: focus, hoverBorderColor: focus, activeOutlineColor: focusShadow },
    },
  };
}

/** Theme for the dark sider: navy focus is invisible on near-black, so focus switches to the live accent. */
export function buildSiderTheme(source: Tokens = tokens): ThemeConfig {
  return { token: { colorPrimaryBorder: source.color.live, lineWidthFocus: FOCUS_RING_WIDTH } };
}

export const antdTheme: ThemeConfig = buildAntdTheme();
