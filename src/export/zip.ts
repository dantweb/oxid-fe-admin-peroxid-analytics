/**
 * A ZIP archive with no compression ("stored"): enough for an XLSX (a few kilobytes of XML), about sixty lines and no
 * dependency. Entry names are UTF-8 (flag bit 11); the time stamp is the fixed DOS date 1980-01-01 so that the same
 * input gives the same bytes.
 */
export interface ZipFile {
  name: string;
  data: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;
const VERSION = 20;
const UTF8_FLAG = 0x0800;
const DOS_DATE_1980_01_01 = 0x0021;

const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

class Writer {
  private readonly chunks: Uint8Array[] = [];
  length = 0;

  u16(value: number): void {
    this.bytes(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.bytes(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  bytes(chunk: Uint8Array): void {
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  result(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

interface Placed {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
}

export function zipStored(files: readonly ZipFile[]): Uint8Array {
  const out = new Writer();
  const encoder = new TextEncoder();
  const placed: Placed[] = [];
  for (const file of files) {
    const entry: Placed = {
      name: encoder.encode(file.name),
      crc: crc32(file.data),
      size: file.data.length,
      offset: out.length,
    };
    placed.push(entry);
    out.u32(LOCAL_HEADER);
    out.u16(VERSION);
    out.u16(UTF8_FLAG);
    out.u16(0); // stored
    out.u16(0); // time
    out.u16(DOS_DATE_1980_01_01);
    out.u32(entry.crc);
    out.u32(entry.size);
    out.u32(entry.size);
    out.u16(entry.name.length);
    out.u16(0);
    out.bytes(entry.name);
    out.bytes(file.data);
  }
  const directoryStart = out.length;
  for (const entry of placed) {
    out.u32(CENTRAL_HEADER);
    out.u16(VERSION);
    out.u16(VERSION);
    out.u16(UTF8_FLAG);
    out.u16(0);
    out.u16(0);
    out.u16(DOS_DATE_1980_01_01);
    out.u32(entry.crc);
    out.u32(entry.size);
    out.u32(entry.size);
    out.u16(entry.name.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk
    out.u16(0); // internal attributes
    out.u32(0); // external attributes
    out.u32(entry.offset);
    out.bytes(entry.name);
  }
  const directorySize = out.length - directoryStart;
  out.u32(END_OF_DIRECTORY);
  out.u16(0);
  out.u16(0);
  out.u16(placed.length);
  out.u16(placed.length);
  out.u32(directorySize);
  out.u32(directoryStart);
  out.u16(0);
  return out.result();
}
