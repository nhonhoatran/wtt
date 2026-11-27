import { describe, expect, it } from 'vitest';
import { isAutoScheduleWriteConflict } from './auto-schedule-conflict.js';

describe('automatic schedule serialization errors', () => {
  it.each([
    { code: 'P2034' },
    { code: 'P2010', meta: { code: '40001' } },
    { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '40001', kind: 'TransactionWriteConflict' } } } },
    { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '40P01' } } } },
  ])('recognizes wrapped conflict %j', (error) => expect(isAutoScheduleWriteConflict(error)).toBe(true));

  it('keeps unrelated database or validation errors visible', () => {
    for (const error of [null, new Error('boom'), { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '42601', kind: 'SyntaxError' } } } }]) expect(isAutoScheduleWriteConflict(error)).toBe(false);
  });
});
