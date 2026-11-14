import { runApiSeed } from './support/api-world-runner';

export default async function globalTeardown(): Promise<void> {
  runApiSeed('public-world.cleanup.seed.ts');
}
