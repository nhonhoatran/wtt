import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BULL_BOARD_PATH } from '../src/modules/queue/bull-board-mount.js';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';

const QUEUES_API = `${BULL_BOARD_PATH}/api/queues`;
const RETRY_FAILED = `${BULL_BOARD_PATH}/api/queues/maintenance/retry/failed`;

describe('bull-board mount guard (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let operator: TestUser;
  let adminCookie: string;
  let operatorCookie: string;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({ role: 'ADMIN' });
    operator = await kit.createUser({ role: 'RESULTS_OPERATOR' });
    adminCookie = await kit.signIn(admin);
    operatorCookie = await kit.signIn(operator);
  });

  afterAll(async () => {
    await kit.close();
  });

  it('answers 401 on every bull-board path, including static assets and writes, when signed out', async () => {
    await kit.get(`${BULL_BOARD_PATH}/static/app.js`).expect(401);
    await kit.get(QUEUES_API).expect(401);
    await kit.http.delete(`${BULL_BOARD_PATH}/api/queues/maintenance/jobs/probe`).expect(401);
    await kit.http.put(RETRY_FAILED).set('Origin', kit.origin).expect(401);
  });

  it('answers 403 to RESULTS_OPERATOR on reads and on retry writes', async () => {
    const read = await kit.get(QUEUES_API, operatorCookie).expect(403);
    expect(read.body.error.code).toBe('FORBIDDEN');
    const write = await kit.http.put(RETRY_FAILED).set('Cookie', operatorCookie).set('Origin', kit.origin).expect(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  });

  it('answers 403 ORIGIN_MISMATCH to an ADMIN write that carries no Origin header', async () => {
    const res = await kit.http.put(RETRY_FAILED).set('Cookie', adminCookie).expect(403);
    expect(res.body.error.code).toBe('ORIGIN_MISMATCH');
    await kit.http.delete(`${BULL_BOARD_PATH}/api/queues/maintenance/jobs/probe`).set('Cookie', adminCookie).expect(403);
  });

  it('lets ADMIN read the board with a trusted Origin for writes', async () => {
    await kit.get(QUEUES_API, adminCookie).expect(200);
  });
});
