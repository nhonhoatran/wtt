import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorBody } from './http-exception.filter.js';

describe('toErrorBody retryable database conflicts', () => {
  it.each([
    ['Prisma P2034', { code: 'P2034', message: 'Transaction failed due to a write conflict or a deadlock' }],
    ['wrapped Postgres deadlock', { code: 'P2010', meta: { code: '40P01' }, message: 'Raw query failed' }],
    ['serialization failure', { code: '40001', message: 'could not serialize access' }],
    ['deadlock text only', new Error('deadlock detected')],
  ])('turns %s into 409 CONCURRENT_UPDATE_RETRY', (_label, error) => {
    expect(toErrorBody(error)).toMatchObject({ status: 409, body: { error: { code: 'CONCURRENT_UPDATE_RETRY' } } });
  });

  it('keeps other unknown errors as 500 and HttpExceptions untouched', () => {
    expect(toErrorBody(new Error('boom')).status).toBe(500);
    expect(toErrorBody(new BadRequestException({ code: 'X', message: 'm' }))).toMatchObject({ status: 400, body: { error: { code: 'X' } } });
  });
});
