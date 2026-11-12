export interface AuthEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

export const AUTH_BASE_PATH = '/api/v1/auth';

export function dbConnection(rawUrl: string): { connectionString: string; schema: string } {
  const url = new URL(rawUrl);
  const schema = url.searchParams.get('schema') ?? 'public';
  url.searchParams.delete('schema');
  return { connectionString: url.toString(), schema };
}
