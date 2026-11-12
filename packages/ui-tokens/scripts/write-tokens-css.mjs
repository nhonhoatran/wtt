import { mkdirSync, writeFileSync } from 'node:fs';
import { buildCssText } from '../dist/build-css-variables.js';

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/tokens.css', import.meta.url), buildCssText());
