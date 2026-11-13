import { DrawParamsError } from './types.js';

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[];
}

// cyrb128 string hash feeding sfc32: deterministic across runtimes, no platform Math.random.
function hashSeed(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function createRng(seed: string): Rng {
  let [a, b, c, d] = hashSeed(seed);
  const next = (): number => {
    const t = (((a + b) | 0) + (d = (d + 1) | 0)) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) + t;
    c |= 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new DrawParamsError('INVALID_PARAMS', `Invalid random range: ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  };

  return { next, int, shuffle };
}
