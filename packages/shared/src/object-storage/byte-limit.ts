import { Transform } from 'node:stream';
import { PayloadTooLargeError } from './object-storage.js';

/** Passes bytes through and errors the stream as soon as the running total passes maxBytes. */
export function byteLimit(maxBytes: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      seen += chunk.length;
      if (seen > maxBytes) callback(new PayloadTooLargeError(maxBytes));
      else callback(null, chunk);
    },
  });
}
