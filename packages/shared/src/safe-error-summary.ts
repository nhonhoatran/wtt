const ERROR_TYPES = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError',
  'AbortError', 'TimeoutError', 'ReplyError', 'MaxRetriesPerRequestError', 'UnrecoverableError', 'ZodError',
  'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientValidationError',
  'PrismaClientInitializationError', 'PrismaClientRustPanicError', 'HttpException', 'BadRequestException',
  'UnauthorizedException', 'ForbiddenException', 'NotFoundException', 'ConflictException',
  'UnprocessableEntityException', 'InternalServerErrorException', 'ServiceUnavailableException', 'UnknownError',
]);
const ERROR_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ENOENT', 'EACCES', 'EPERM',
  'ERR_INVALID_ARG_TYPE', 'ERR_INVALID_URL', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_HTTP_HEADERS_SENT',
  '23502', '23503', '23505', '23514', '40001', '40P01', '42P01', '42703', '28P01', '3D000', '53300', '57P01',
]);

export interface SafeErrorSummary { type: string; code?: string }

/** Log only fixed technical identifiers: messages, stacks, metadata and arbitrary names/codes may contain PII. */
export function safeErrorSummary(error: unknown): SafeErrorSummary {
  try {
    if (typeof error !== 'object' || error === null) return { type: 'UnknownError' };
    const value = error as { name?: unknown; type?: unknown; code?: unknown };
    const candidate = typeof value.name === 'string' ? value.name : value.type;
    const type = typeof candidate === 'string' && ERROR_TYPES.has(candidate) ? candidate : 'UnknownError';
    const code = typeof value.code === 'string' && (ERROR_CODES.has(value.code) || /^P\d{4}$/.test(value.code)) ? value.code : undefined;
    return { type, ...(code && { code }) };
  } catch { return { type: 'UnknownError' }; }
}
