import { zipSync } from 'fflate';

const EOCD_SIGNATURE = 0x06054b50;
const CD_FIXED_BYTES = 46;

/**
 * Zip whose central directory lists `copies` entries that all point at the same big local entry.
 * The tiny extra local entries keep the entry count of both directories equal.
 */
export function buildOverlappingZip(copies: number, bigEntryBytes: number): Buffer {
  const files: Record<string, Uint8Array> = { 'xl/worksheets/sheet1.xml': new Uint8Array(bigEntryBytes) };
  for (let i = 1; i < copies; i += 1) files[`xl/extra${i}.xml`] = new Uint8Array(0);
  const zip = Buffer.from(zipSync(files, { level: 9 }));
  let eocd = zip.length - 22;
  while (zip.readUInt32LE(eocd) !== EOCD_SIGNATURE) eocd -= 1;
  let cursor = zip.readUInt32LE(eocd + 16);
  const first = cursor;
  for (let i = 0; i < copies; i += 1) {
    if (i > 0) {
      zip.copy(zip, cursor + 10, first + 10, first + 16);
      zip.copy(zip, cursor + 16, first + 16, first + 28);
      zip.copy(zip, cursor + 42, first + 42, first + 46);
    }
    cursor += CD_FIXED_BYTES + zip.readUInt16LE(cursor + 28) + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
  }
  return zip;
}
