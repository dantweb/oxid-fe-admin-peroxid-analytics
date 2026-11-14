/** A test-side reader for a stored ZIP (the only kind the plugin writes): the entries, with their CRC checked. */
import { crc32 } from '../../../src/export/zip';

export interface Entry {
  name: string;
  data: Uint8Array;
}

export function unzipStored(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: Entry[] = [];
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const method = view.getUint16(at + 8, true);
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const nameStart = at + 30;
    const dataStart = nameStart + nameLength + extraLength;
    if (method !== 0) {
      throw new Error('not a stored entry');
    }
    const data = bytes.slice(dataStart, dataStart + size);
    if (crc32(data) !== crc) {
      throw new Error('bad CRC');
    }
    entries.push({
      name: new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength)),
      data,
    });
    at = dataStart + size;
  }
  return entries;
}

/** The end-of-central-directory record: how many entries the archive says it has. */
export function centralDirectoryCount(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = bytes.length - 22; at >= 0; at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      return view.getUint16(at + 10, true);
    }
  }
  throw new Error('no end of central directory');
}
