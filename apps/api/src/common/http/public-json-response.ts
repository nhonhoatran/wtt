import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import type { Request, Response } from 'express';

const compress = promisify(gzip);
// Compress large public payloads only; tiny responses do not benefit from gzip framing.
const COMPRESSION_THRESHOLD_BYTES = 1024;

/** Preserve the complete snapshot while reducing bytes transferred to the server renderer. */
export async function sendPublicJson<T>(request: Request, response: Response, data: T): Promise<void> {
  const body = Buffer.from(JSON.stringify({ data }), 'utf8');
  response.vary('Accept-Encoding');
  response.type('application/json; charset=utf-8');
  if (body.byteLength >= COMPRESSION_THRESHOLD_BYTES && request.acceptsEncodings('gzip', 'identity') === 'gzip') {
    const compressed = await compress(body);
    if (compressed.byteLength < body.byteLength) {
      response.set('Content-Encoding', 'gzip');
      response.send(compressed);
      return;
    }
  }
  response.send(body);
}
