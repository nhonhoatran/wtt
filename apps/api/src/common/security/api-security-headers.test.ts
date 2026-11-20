import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { applyApiSecurityHeaders } from './api-security-headers.js';

describe('API security headers', () => {
  it('adds transport, content-type, referrer, and frame protections without a browser CSP', async () => {
    const app = express();
    applyApiSecurityHeaders(app);
    app.get('/health', (_req, res) => res.status(200).send('ok'));

    const response = await request(app).get('/health').expect(200);

    expect(response.headers['strict-transport-security']).toMatch(/^max-age=15552000(?:;|$)/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers).not.toHaveProperty('content-security-policy');
    expect(response.headers).not.toHaveProperty('content-security-policy-report-only');
  });
});
