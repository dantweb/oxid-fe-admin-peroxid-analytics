/**
 * A TypeScript port of the data model of `dantweb/atomizer` (PHP): an **Atom** is one typed value of a
 * named field, a **Vector** is one row of atoms keyed by field name, a **Matrix** is a list of rows.
 * The analytics series are computed over matrices, so a backend that delivers rows in another shape
 * only needs an adapter that produces atoms (atomizer's `AdapterInterface` idea).
 */
export type AtomType = 'int' | 'float' | 'string' | 'timestamp';

export interface Atom<T = unknown> {
  readonly name: string;
  readonly type: AtomType;
  readonly value: T;
}

export class AtomTypeError extends Error {
  constructor(name: string, type: AtomType, value: unknown) {
    super(`atom "${name}": expected ${type}, got ${describe(value)}`);
    this.name = 'AtomTypeError';
  }
}

function describe(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value instanceof Date) {
    return 'Date';
  }
  return typeof value;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Coerces like atomizer's `Atom::setValue`: an int from a whole number or numeric string, a timestamp from a Date, epoch seconds or an ISO string. */
export function atom(name: string, type: 'int' | 'float', value: unknown): Atom<number>;
export function atom(name: string, type: 'string', value: unknown): Atom<string>;
export function atom(name: string, type: 'timestamp', value: unknown): Atom<Date>;
export function atom(name: string, type: AtomType, value: unknown): Atom {
  switch (type) {
    case 'int': {
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (!isFiniteNumber(number) || !Number.isInteger(number)) {
        throw new AtomTypeError(name, type, value);
      }
      return { name, type, value: number };
    }
    case 'float': {
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (!isFiniteNumber(number)) {
        throw new AtomTypeError(name, type, value);
      }
      return { name, type, value: number };
    }
    case 'string': {
      if (typeof value !== 'string') {
        throw new AtomTypeError(name, type, value);
      }
      return { name, type, value };
    }
    case 'timestamp': {
      const date =
        value instanceof Date
          ? value
          : isFiniteNumber(value)
            ? new Date(value * 1000)
            : typeof value === 'string'
              ? new Date(value)
              : null;
      if (date === null || Number.isNaN(date.getTime())) {
        throw new AtomTypeError(name, type, value);
      }
      return { name, type, value: date };
    }
  }
}

/** One row: atoms by field name (a later atom of the same name replaces the earlier one). */
export class Vector {
  private readonly atoms = new Map<string, Atom>();

  add(item: Atom): this {
    this.atoms.set(item.name, item);
    return this;
  }

  has(name: string): boolean {
    return this.atoms.has(name);
  }

  get<T = unknown>(name: string): T {
    const found = this.atoms.get(name);
    if (found === undefined) {
      throw new Error(`vector has no atom "${name}"`);
    }
    return found.value as T;
  }

  names(): string[] {
    return [...this.atoms.keys()];
  }

  get count(): number {
    return this.atoms.size;
  }
}

/** The rows of one model (orders, customers, …). */
export class Matrix {
  private readonly vectors: Vector[] = [];

  constructor(rows: Iterable<Vector> = []) {
    for (const row of rows) {
      this.vectors.push(row);
    }
  }

  add(row: Vector): this {
    this.vectors.push(row);
    return this;
  }

  get rows(): readonly Vector[] {
    return this.vectors;
  }

  get count(): number {
    return this.vectors.length;
  }

  /** The values of one field down the rows. */
  column<T = unknown>(name: string): T[] {
    return this.vectors.map((row) => row.get<T>(name));
  }
}
