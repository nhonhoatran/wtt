import { describe, expect, it } from 'vitest';
import { buildAntdTheme } from './antd-theme.js';
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
});
