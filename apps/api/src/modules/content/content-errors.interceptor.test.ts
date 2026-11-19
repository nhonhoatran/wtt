import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { contentWriteError } from './content-errors.interceptor.js';

describe('contentWriteError', () => {
  it('maps missing CMS rows, duplicate slugs, and deleted references to actionable errors', () => {
    expect(contentWriteError({ code: 'P2025' })).toBeInstanceOf(NotFoundException);
    expect(contentWriteError({ code: 'P2002' })).toBeInstanceOf(ConflictException);
    expect(contentWriteError({ code: 'P2003' })).toBeInstanceOf(UnprocessableEntityException);
  });
  it('preserves unexpected errors', () => {
    const error = new Error('network unavailable');
    expect(contentWriteError(error)).toBe(error);
  });
});
