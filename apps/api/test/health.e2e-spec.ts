import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../src/bootstrap-app.js';

describe('health endpoints (real dependencies from .env)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApiApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live returns ok without touching dependencies', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('GET /api/v1/health/ready reports every dependency up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(res.body.status).toBe('ready');
    expect(Object.keys(res.body.checks).sort()).toEqual(['database', 'migrations', 'redis', 'storage']);
    for (const check of Object.values<{ status: string }>(res.body.checks)) expect(check.status).toBe('up');
  });

  it('unknown routes use the standard error body', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('echoes a well-formed x-request-id and replaces a malformed one', async () => {
    const good = await request(app.getHttpServer()).get('/api/v1/health/live').set('x-request-id', 'abc-123');
    expect(good.headers['x-request-id']).toBe('abc-123');
    const bad = await request(app.getHttpServer()).get('/api/v1/health/live').set('x-request-id', 'bad id;drop');
    expect(bad.headers['x-request-id']).not.toBe('bad id;drop');
  });
});
