import { tokens, type Tokens } from './tokens.js';

const kebab = (value: string) => value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

export function buildCssVariables(source: Tokens = tokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(source.color)) vars[`--color-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(source.radius)) vars[`--radius-${kebab(name)}`] = `${value}px`;
  for (const [name, value] of Object.entries(source.space)) vars[`--space-${kebab(name)}`] = `${value}px`;
  for (const [name, value] of Object.entries(source.layout)) vars[`--layout-${kebab(name)}`] = `${value}px`;
  vars['--font-family'] = source.font.family;
  return vars;
}

export function buildCssText(source: Tokens = tokens): string {
  const lines = Object.entries(buildCssVariables(source)).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}
