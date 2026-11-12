import { z } from 'zod';

export const appEnvSchema = z.enum(['development', 'test', 'staging', 'production']);

/** Comma-separated env list -> trimmed non-empty strings. */
export const csvList = z
  .string()
  .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean));

export const requiredString = z.string().trim().min(1);

const PLACEHOLDER_SECRET = /^(replace-with|change-me)/i;

export const secretString = z
  .string()
  .min(32, 'must be at least 32 characters')
  .refine((value) => !PLACEHOLDER_SECRET.test(value), 'still the .env.example placeholder');

/**
 * Validates env and throws an error listing only variable names and reasons, never values.
 */
export function parseEnv<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  const normalized = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(normalized);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    const reason = issue.code === 'invalid_type' && issue.input === undefined ? 'missing' : issue.message;
    return `  - ${name}: ${reason}`;
  });
  throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
}
