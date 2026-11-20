import { Writable } from 'node:stream';
import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { httpLoggerOptions } from './logger.module.js';

describe('HTTP log privacy', () => {
  it('logs only request identity/method, matched route, status and safe error identifiers', async () => {
    let output = '';
    const destination = new Writable({ write(chunk, _encoding, done) { output += chunk.toString(); done(); } });
    const app = express();
    app.use(pinoHttp(httpLoggerOptions('info'), destination));
    app.get('/players/:slug', (_req, res) => {
      res.setHeader('set-cookie', 'private-cookie=secret');
      res.err = Object.assign(new Error('person@example.test private-password'), { code: 'P2002' });
      res.status(500).send('private response body');
    });
    await request(app).get('/players/person@example.test?password=private-password')
      .set('x-request-id', 'request-123').set('authorization', 'Bearer private-token')
      .set('cookie', 'private-cookie=secret').set('x-forwarded-for', '192.0.2.99').expect(500);

    const lines = output.trim().split('\n').map((line) => JSON.parse(line));
    const completed = lines.at(-1);
    expect(completed.req).toEqual({ id: 'request-123', method: 'GET' });
    expect(completed.route).toBe('/players/:slug');
    expect(completed.res).toEqual({ statusCode: 500 });
    expect(completed.err).toEqual({ type: 'Error', code: 'P2002' });
    for (const privateText of ['person@example.test', 'private-password', 'private-token', 'private-cookie', '192.0.2.99', 'remoteAddress', 'headers', 'stack']) {
      expect(output).not.toContain(privateText);
    }
  });
});
