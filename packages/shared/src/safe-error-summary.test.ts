import { describe, expect, it } from 'vitest';
import { safeErrorSummary } from './safe-error-summary.js';

describe('safeErrorSummary', () => {
  it('keeps known error types and stable technical codes without private details', () => {
    const error = Object.assign(new Error('password=secret email=person@example.test'), {
      name: 'PrismaClientKnownRequestError', code: 'P2002', meta: { target: 'person@example.test' },
    });
    expect(safeErrorSummary(error)).toEqual({ type: 'PrismaClientKnownRequestError', code: 'P2002' });
    expect(safeErrorSummary(Object.assign(new Error('redis://user:secret@private'), { code: 'ECONNREFUSED' })))
      .toEqual({ type: 'Error', code: 'ECONNREFUSED' });
  });

  it('rejects arbitrary identifiers, primitives and hostile property access', () => {
    for (const value of ['person@example.test', null, { name: 'Person Name', code: 'ALICE' }, { get name() { throw new Error('secret'); } }]) {
      expect(safeErrorSummary(value)).toEqual({ type: 'UnknownError' });
    }
  });

  it('is idempotent when a logger serializer receives an already sanitized summary', () => {
    const summary = safeErrorSummary(Object.assign(new TypeError('private'), { code: 'ERR_INVALID_ARG_TYPE' }));
    expect(safeErrorSummary(summary)).toEqual(summary);
  });
});
