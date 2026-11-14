import { describe, expect, it } from 'vitest';
import { crc32, zipStored } from '../../../src/export/zip';
import { centralDirectoryCount, unzipStored } from './unzip';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('crc32', () => {
  it('matches the known check value of "123456789"', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });

  it('is 0 for nothing', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('zipStored', () => {
  const files = [
    { name: 'a.txt', data: bytes('hello') },
    { name: 'dir/ü.xml', data: bytes('<x>€</x>') },
    { name: 'empty', data: new Uint8Array() },
  ];

  it('round-trips the files with their names and contents', () => {
    const zip = zipStored(files);

    const entries = unzipStored(zip);

    expect(entries.map((entry) => entry.name)).toEqual(['a.txt', 'dir/ü.xml', 'empty']);
    expect(entries.map((entry) => new TextDecoder().decode(entry.data))).toEqual([
      'hello',
      '<x>€</x>',
      '',
    ]);
  });

  it('writes a central directory that lists every entry, and starts with the local header signature', () => {
    const zip = zipStored(files);

    expect(centralDirectoryCount(zip)).toBe(3);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('marks names as UTF-8 (general purpose flag bit 11)', () => {
    const view = new DataView(zipStored(files).buffer);

    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
  });
});
