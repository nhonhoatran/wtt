import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string>; dependants?: Record<string, number>; suggestion?: string; issues?: unknown[] };
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
};

export function toErrorBody(exception: unknown): { status: number; body: ApiErrorBody } {
  if (!(exception instanceof HttpException)) {
    return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } } };
  }
  const status = exception.getStatus();
  const payload = exception.getResponse();
  const custom = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const code = typeof custom.code === 'string' ? custom.code : (STATUS_CODES[status] ?? `HTTP_${status}`);
  const message = typeof custom.message === 'string' ? custom.message : exception.message;
  const fields = custom.fields && typeof custom.fields === 'object' ? (custom.fields as Record<string, string>) : undefined;
  const dependants =
    custom.dependants && typeof custom.dependants === 'object' ? (custom.dependants as Record<string, number>) : undefined;
  const suggestion = typeof custom.suggestion === 'string' ? custom.suggestion : undefined;
  const issues = Array.isArray(custom.issues) ? custom.issues : undefined;
  return {
    status,
    body: { error: { code, message, ...(fields && { fields }), ...(dependants && { dependants }), ...(suggestion && { suggestion }), ...(issues && { issues }) } },
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toErrorBody(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception);
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }
}
