import { tournamentSettings } from '@kamito/shared';
import { fieldError } from '../../common/validation/parse-body.js';

const BYTES_PER_MEGABYTE = 1024 * 1024;

/** Settings bounded by a server env ceiling; a value above it is rejected with the ceiling in the message. */
export function assertWithinEnvCeiling(key: string, value: unknown, env: { UPLOAD_MAX_IMAGE_BYTES: number }): void {
  if (key !== tournamentSettings.maxImageMegabytes.key || typeof value !== 'number') return;
  if (value * BYTES_PER_MEGABYTE > env.UPLOAD_MAX_IMAGE_BYTES) {
    const ceiling = Math.floor(env.UPLOAD_MAX_IMAGE_BYTES / BYTES_PER_MEGABYTE);
    throw fieldError('value', `Máy chủ chỉ cho phép tối đa ${ceiling} MB mỗi ảnh (UPLOAD_MAX_IMAGE_BYTES)`, 'ABOVE_SERVER_CEILING');
  }
}
