import { createInterface as createLineReader } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

// A readline over a pipe buffers every line it reads, so piped input must share one reader.
let pipedLines: AsyncIterator<string> | undefined;

async function readPipedLine(question: string): Promise<string> {
  stdout.write(question);
  pipedLines ??= createLineReader({ input: stdin, crlfDelay: Infinity })[Symbol.asyncIterator]();
  const next = await pipedLines.next();
  if (next.done) throw new Error('Input ended before all answers were given');
  return next.value.trim();
}

export async function ask(question: string): Promise<string> {
  if (!stdin.isTTY) return readPipedLine(question);
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it; falls back to a plain line read when stdin is piped. */
export async function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) return ask(question);
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return finish(() => resolve(value));
        if (char === '\u0003') return finish(() => reject(new Error('Cancelled')));
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    const finish = (done: () => void) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      done();
    };
    stdin.on('data', onData);
  });
}
