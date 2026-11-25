import { describe, expect, it } from 'vitest';
import { buildAntdTheme, buildSiderTheme } from './antd-theme.js';
import { buildCssText, buildCssVariables } from './build-css-variables.js';
import { tokens } from './tokens.js';

describe('ui tokens', () => {
  it('maps colors and sizes to CSS variables', () => {
    const vars = buildCssVariables();
    expect(vars['--color-primary']).toBe(tokens.color.primary);
    expect(vars['--color-primary-strong']).toBe(tokens.color.primaryStrong);
    expect(vars['--radius-pill']).toBe('999px');
    expect(vars['--layout-container-max']).toBe('1520px');
  });

  it('exposes the text-safe red, result colours and ink surface as CSS variables', () => {
    const vars = buildCssVariables();
    expect(vars['--color-primary-text']).toBe('#D71920');
    expect(vars['--color-success']).toBe('#15803D');
    expect(vars['--color-success-on-dark']).toBe('#4ADE80');
    expect(vars['--color-danger-on-dark']).toBe('#FF8A8A');
  });

  it('exposes the caution pill colours as CSS variables', () => {
    const vars = buildCssVariables();
    expect(vars['--color-warning-surface']).toBe('#FEF3C7');
    expect(vars['--color-warning-text']).toBe('#78350F');
  });

  it('keeps the caution pill text at WCAG AA contrast (4.5:1) on its surface', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const [a, b] = [luminance(tokens.color.warningSurface), luminance(tokens.color.warningText)];
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves the primary red used by the admin theme untouched', () => {
    expect(tokens.color.primary).toBe('#EC1E24');
  });

  it('emits a :root block', () => {
    expect(buildCssText()).toMatch(/^:root \{\n {2}--color-primary: #EC1E24;/);
  });

  it('feeds the same primary color to antd', () => {
    expect(buildAntdTheme().token?.colorPrimary).toBe(tokens.color.primary);
  });

  it('draws focus in navy so it is not mistaken for an error', () => {
    const theme = buildAntdTheme();
    expect(theme.token?.colorPrimaryBorder).toBe(tokens.color.data);
    expect(theme.token?.controlOutline).toBe('rgba(15, 40, 93, 0.16)');
    expect(theme.components?.Input?.activeBorderColor).toBe(tokens.color.data);
    expect(theme.components?.Select?.activeBorderColor).toBe(tokens.color.data);
  });

  it('uses a white header and a strong red for the selected dark menu item', () => {
    const theme = buildAntdTheme();
    expect(theme.components?.Layout?.headerBg).toBe(tokens.color.surface);
    expect(theme.components?.Menu?.darkItemSelectedBg).toBe(tokens.color.primaryStrong);
  });

  it('draws sider focus in the live accent', () => {
    const theme = buildSiderTheme();
    expect(theme.token?.colorPrimaryBorder).toBe(tokens.color.live);
    expect(theme.token?.lineWidthFocus).toBe(2);
  });
});
