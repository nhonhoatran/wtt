import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const clientRoot = path.resolve(import.meta.dirname, '../..');

/** CSS-module class names are supplied by Vite, while declarations come from the actual source. */
export async function moduleCss(relative: string, names: Record<string, string>): Promise<string> {
  const css = await readFile(path.join(clientRoot, relative), 'utf8');
  return css.replace(/:global\(([^)]+)\)/g, '$1')
    .replace(/\.([_a-z][\w-]*)/gi, (whole, name: string) => `.${names[name] ?? whole.slice(1)}`);
}

export async function productionFonts(): Promise<string> {
  const chunks = path.join(clientRoot, '.next/static/chunks');
  const faces: string[] = [];
  for (const file of await readdir(chunks)) {
    if (!file.endsWith('.css')) continue;
    const css = await readFile(path.join(chunks, file), 'utf8');
    for (const [face] of css.matchAll(/@font-face\{[^}]+\}/g)) {
      if (!face.includes('font-family:Archivo;')) continue;
      let result = face;
      for (const [reference, filename] of face.matchAll(/url\(\.\.\/media\/([^)]*)\)/g)) {
        const bytes = await readFile(path.join(clientRoot, '.next/static/media', filename!));
        result = result.replace(reference, `url(data:font/woff2;base64,${bytes.toString('base64')})`);
      }
      faces.push(result);
    }
  }
  if (!faces.length) throw new Error('Build the Next client first: the offline print check uses its real Archivo font.');
  return faces.join('\n');
}
