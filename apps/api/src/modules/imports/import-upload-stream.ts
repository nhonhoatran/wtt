import { HttpException, UnsupportedMediaTypeException } from '@nestjs/common';
import { PayloadTooLargeError, type ObjectStorage } from '@kamito/shared/object-storage';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';

const tooLarge = (maxBytes: number) =>
  new HttpException({ code: 'PAYLOAD_TOO_LARGE', message: `File vượt quá ${Math.floor(maxBytes / 1024 / 1024) || 1} MB cho phép` }, 413);

/** Stops reading the request body without destroying the socket, so the 413 can still be sent. */
async function* limitedChunks(req: Request, maxBytes: number): AsyncGenerator<Buffer> {
  let seen = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    seen += (chunk as Buffer).length;
    if (seen > maxBytes) throw new PayloadTooLargeError(maxBytes);
    yield chunk as Buffer;
  }
}

/** Streams the raw xlsx body into storage under a hard byte cap; nothing is kept on any failure. */
export async function receiveWorkbook(
  req: Request,
  res: Response,
  storage: ObjectStorage,
  options: { key: string; mime: string; maxBytes: number },
): Promise<number> {
  const { key, mime, maxBytes } = options;
  const contentType = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (contentType !== mime) {
    throw new UnsupportedMediaTypeException({ code: 'CONTENT_TYPE_MISMATCH', message: 'Content-Type phải là file Excel (.xlsx)' });
  }
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
    await storage.put(key, Readable.from(limitedChunks(req, maxBytes)), { contentType: mime, maxBytes });
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
    throw new HttpException({ code: 'EMPTY_UPLOAD', message: 'Không nhận được nội dung file' }, 422);
  }
  return stored.size;
}
