import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const apiRoot = fileURLToPath(new URL('../..', import.meta.url));
const promptsUrl = pathToFileURL(fileURLToPath(new URL('./terminal-prompts.ts', import.meta.url))).href;

/** Runs two sequential ask() calls in a child process with piped stdin, as `printf 'a\nb\n' | create-admin` would. */
function askTwiceFromPipe(input: string): { stdout: string; status: number | null } {
  const script = `
    import { ask } from ${JSON.stringify(promptsUrl)};
    const first = await ask('1: ');
    const second = await ask('2: ');
    process.stdout.write(JSON.stringify([first, second]));
  `;
  const result = spawnSync(
    process.execPath,
    ['--import', '@swc-node/register/esm-register', '--input-type=module', '-e', script],
    { cwd: apiRoot, input, encoding: 'utf8', timeout: 30_000 },
  );
  return { stdout: result.stdout, status: result.status };
}

describe('terminal prompts with piped stdin', () => {
  it('answers two sequential prompts from one pipe', () => {
    const { stdout, status } = askTwiceFromPipe('first\nsecond\n');
    expect(status).toBe(0);
    expect(JSON.parse(stdout.replace(/^1: 2: /, ''))).toEqual(['first', 'second']);
  });
});
