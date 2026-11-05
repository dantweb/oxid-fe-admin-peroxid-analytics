import { describe, expect, it } from 'vitest';
import { atom, AtomTypeError, Matrix, Vector } from '../../src/atomizer/model';

describe('atom (port of atomizer’s Atom::setValue)', () => {
  it('coerces an int from a whole number or a numeric string, refuses the rest', () => {
    expect(atom('n', 'int', 3).value).toBe(3);
    expect(atom('n', 'int', '42').value).toBe(42);
    expect(() => atom('n', 'int', 1.5)).toThrow(AtomTypeError);
    expect(() => atom('n', 'int', 'x')).toThrow(/expected int, got string/);
  });

  it('a float from any finite number, a string only from a string', () => {
    expect(atom('f', 'float', '12.50').value).toBe(12.5);
    expect(() => atom('f', 'float', Number.NaN)).toThrow(AtomTypeError);
    expect(atom('s', 'string', 'ORD-1').value).toBe('ORD-1');
    expect(() => atom('s', 'string', 1)).toThrow(AtomTypeError);
  });

  it('a timestamp from a Date, epoch seconds or an ISO string', () => {
    const date = new Date('2026-01-02T03:04:05Z');
    expect(atom('t', 'timestamp', date).value).toEqual(date);
    expect(atom('t', 'timestamp', 1_767_322_800).value).toEqual(new Date(1_767_322_800_000));
    expect(atom('t', 'timestamp', '2026-01-02T03:04:05Z').value).toEqual(date);
    expect(() => atom('t', 'timestamp', 'yesterday-ish')).toThrow(AtomTypeError);
    expect(() => atom('t', 'timestamp', null)).toThrow(/got null/);
  });
});

describe('Vector and Matrix', () => {
  it('a vector keys atoms by name, a later one replaces the earlier', () => {
    const row = new Vector()
      .add(atom('a', 'int', 1))
      .add(atom('b', 'string', 'x'))
      .add(atom('a', 'int', 2));

    expect(row.count).toBe(2);
    expect(row.names()).toEqual(['a', 'b']);
    expect(row.get<number>('a')).toBe(2);
    expect(row.has('c')).toBe(false);
    expect(() => row.get('c')).toThrow(/no atom "c"/);
  });

  it('a matrix lists rows and reads a column', () => {
    const matrix = new Matrix([new Vector().add(atom('n', 'int', 1))]).add(
      new Vector().add(atom('n', 'int', 2)),
    );

    expect(matrix.count).toBe(2);
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.column<number>('n')).toEqual([1, 2]);
  });
});
