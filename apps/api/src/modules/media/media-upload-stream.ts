import { HttpException, UnsupportedMediaTypeException } from '@nestjs/common';
import { PayloadTooLargeError, type ObjectStorage } from '@kamito/shared/object-storage';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';

function tooLarge(maxBytes: number): HttpException {
  return new HttpException(
    { code: 'PAYLOAD_TOO_LARGE', message: `Ảnh vượt quá ${maxBytes} byte cho phép` },
    413,
  );
}

/** Stops reading the request body without destroying the socket, so the 413 can still be sent. */
async function* limitedChunks(req: Request, maxBytes: number): AsyncGenerator<Buffer> {
  let seen = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    seen += (chunk as Buffer).length;
    if (seen > maxBytes) throw new PayloadTooLargeError(maxBytes);
    yield chunk as Buffer;
  }
}

export interface ReceiveUploadOptions {
  key: string;
  declaredMime: string;
  maxBytes: number;
}

/** Streams the raw request body into storage under a hard byte cap; nothing is kept on any failure. */
export async function receiveUpload(
  req: Request,
  res: Response,
  storage: ObjectStorage,
  options: ReceiveUploadOptions,
): Promise<number> {
  const { key, declaredMime, maxBytes } = options;
  const contentType = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (contentType !== declaredMime.toLowerCase()) {
    throw new UnsupportedMediaTypeException({ code: 'CONTENT_TYPE_MISMATCH', message: 'Content-Type khác loại ảnh đã khai báo' });
  }
  // Close the connection after the response so an oversize body is not read to the end.
  const cutRequest = () => {
    res.setHeader('Connection', 'close');
    res.once('finish', () => req.destroy());
  };
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    cutRequest();
    throw tooLarge(maxBytes);
  }
  try {
    await storage.put(key, Readable.from(limitedChunks(req, maxBytes)), { contentType: declaredMime, maxBytes });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      cutRequest();
      throw tooLarge(maxBytes);
    }
    throw error;
  }
  const stored = await storage.stat(key);
  if (!stored || stored.size === 0) {
    await storage.delete(key);
    throw new HttpException({ code: 'EMPTY_UPLOAD', message: 'Không nhận được dữ liệu ảnh' }, 422);
  }
  return stored.size;
}
