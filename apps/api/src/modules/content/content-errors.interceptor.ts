import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { catchError, throwError } from 'rxjs';

export function contentWriteError(error: unknown): unknown {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'P2025') return new NotFoundException({ code: 'CONTENT_NOT_FOUND', message: 'Không tìm thấy nội dung' });
  if (code === 'P2002') return new ConflictException({ code: 'SLUG_TAKEN', message: 'Slug đã được sử dụng', fields: { slug: 'Chọn slug khác' } });
  if (code === 'P2003') return new UnprocessableEntityException({ code: 'INVALID_REFERENCE', message: 'Ảnh hoặc giải liên quan không còn tồn tại' });
  return error;
}

@Injectable()
export class ContentErrorsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(catchError((error: unknown) => throwError(() => contentWriteError(error))));
  }
}
