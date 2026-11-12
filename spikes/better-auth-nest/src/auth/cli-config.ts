import { createAuth } from './create-auth.js';

export const auth = createAuth({}, { BETTER_AUTH_SECRET: 'x'.repeat(32), BETTER_AUTH_URL: 'https://cli.invalid' });
