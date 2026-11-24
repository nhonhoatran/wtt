import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import { ImportFailure } from './import-row-types.js';

const ZIP_LOCAL_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_MAX_DISTANCE = 22 + 0xffff;
// fflate inflates each pushed chunk in one go and deflate expands up to ~1032:1, so small input chunks keep
// every output burst (and peak memory) near 256 KiB instead of letting one 64 KiB chunk inflate to 64 MiB.
const FEED_CHUNK_BYTES = 256;

class UnzippedTooLarge extends Error {}

export function hasZipSignature(bytes: Uint8Array): boolean {
  return ZIP_LOCAL_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

/** Entry count declared by the central directory (the one exceljs trusts), or null when missing. */
function centralDirectoryEntries(bytes: Buffer): number | null {
  const from = Math.max(0, bytes.length - EOCD_MAX_DISTANCE);
  for (let i = bytes.length - 22; i >= from; i -= 1) {
    if (bytes.readUInt32LE(i) === EOCD_SIGNATURE) return bytes.readUInt16LE(i + 10);
  }
  return null;
}

/**
 * Inflates every entry into the void and counts the bytes actually produced, so a zip bomb is
 * stopped at `maxBytes` regardless of the sizes its headers claim.
 */
export function assertSafeXlsx(bytes: Buffer, maxUnzippedBytes: number): void {
  if (!hasZipSignature(bytes)) throw new ImportFailure('File không phải Excel (.xlsx)');
  let total = 0;
  let entries = 0;
  const unzip = new Unzip((file) => {
    entries += 1;
    file.ondata = (error, chunk) => {
      if (error) throw error;
      total += chunk.length;
      if (total > maxUnzippedBytes) throw new UnzippedTooLarge();
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  try {
    for (let offset = 0; offset < bytes.length; offset += FEED_CHUNK_BYTES) {
      const end = Math.min(offset + FEED_CHUNK_BYTES, bytes.length);
      unzip.push(bytes.subarray(offset, end), end === bytes.length);
    }
  } catch (error) {
    if (error instanceof UnzippedTooLarge) throw new ImportFailure('File giải nén quá lớn');
    throw new ImportFailure('File Excel bị hỏng hoặc không đọc được');
  }
  if (entries === 0 || entries !== centralDirectoryEntries(bytes)) {
    throw new ImportFailure('File Excel bị hỏng hoặc không đọc được');
  }
}
