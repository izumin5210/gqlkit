/**
 * Collections that remember how they were read, for running a computation
 * before its inputs are final.
 *
 * A computation that is deterministic given its inputs and reads one of
 * these only through `has`/`get` takes the same path, and returns the same
 * result, with any other collection that answers those reads the same way.
 * `agreesWith` checks exactly that; enumerating the collection (or asking
 * its size) makes every entry count as read.
 */

export class RecordedSet<T> implements ReadonlySet<T> {
  readonly #values: ReadonlySet<T>;
  readonly #queried = new Set<T>();
  #enumerated = false;

  constructor(values: ReadonlySet<T>) {
    this.#values = values;
  }

  has(value: T): boolean {
    this.#queried.add(value);
    return this.#values.has(value);
  }

  /** Whether `actual` answers every read made so far the same way. */
  agreesWith(actual: ReadonlySet<T>): boolean {
    if (this.#enumerated) {
      return (
        actual.size === this.#values.size &&
        [...actual].every((v) => this.#values.has(v))
      );
    }
    return [...this.#queried].every(
      (v) => actual.has(v) === this.#values.has(v),
    );
  }

  #enumerate(): ReadonlySet<T> {
    this.#enumerated = true;
    return this.#values;
  }

  get size(): number {
    return this.#enumerate().size;
  }

  forEach(
    callback: (value: T, value2: T, set: ReadonlySet<T>) => void,
    thisArg?: unknown,
  ): void {
    this.#enumerate().forEach(callback, thisArg);
  }

  entries(): SetIterator<[T, T]> {
    return this.#enumerate().entries();
  }

  keys(): SetIterator<T> {
    return this.#enumerate().keys();
  }

  values(): SetIterator<T> {
    return this.#enumerate().values();
  }

  [Symbol.iterator](): SetIterator<T> {
    return this.#enumerate()[Symbol.iterator]();
  }

  union<U>(other: ReadonlySetLike<U>): Set<T | U> {
    return new Set(this.#enumerate()).union(other);
  }

  intersection<U>(other: ReadonlySetLike<U>): Set<T & U> {
    return new Set(this.#enumerate()).intersection(other);
  }

  difference<U>(other: ReadonlySetLike<U>): Set<T> {
    return new Set(this.#enumerate()).difference(other);
  }

  symmetricDifference<U>(other: ReadonlySetLike<U>): Set<T | U> {
    return new Set(this.#enumerate()).symmetricDifference(other);
  }

  isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
    return new Set(this.#enumerate()).isSubsetOf(other);
  }

  isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
    return new Set(this.#enumerate()).isSupersetOf(other);
  }

  isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
    return new Set(this.#enumerate()).isDisjointFrom(other);
  }
}

export class RecordedMap<K, V> implements ReadonlyMap<K, V> {
  readonly #entries: ReadonlyMap<K, V>;
  readonly #queried = new Set<K>();
  #enumerated = false;

  constructor(entries: ReadonlyMap<K, V>) {
    this.#entries = entries;
  }

  get(key: K): V | undefined {
    this.#queried.add(key);
    return this.#entries.get(key);
  }

  has(key: K): boolean {
    this.#queried.add(key);
    return this.#entries.has(key);
  }

  /**
   * Whether `actual` answers every read made so far the same way, comparing
   * values with `equals`.
   */
  agreesWith(
    actual: ReadonlyMap<K, V>,
    equals: (a: V, b: V) => boolean,
  ): boolean {
    const sameEntry = (key: K): boolean => {
      const expected = this.#entries.get(key);
      const found = actual.get(key);
      if (expected === undefined || found === undefined) {
        return expected === found && actual.has(key) === this.#entries.has(key);
      }
      return equals(expected, found);
    };
    if (this.#enumerated) {
      return (
        actual.size === this.#entries.size &&
        [...actual.keys()].every(sameEntry)
      );
    }
    return [...this.#queried].every(sameEntry);
  }

  #enumerate(): ReadonlyMap<K, V> {
    this.#enumerated = true;
    return this.#entries;
  }

  get size(): number {
    return this.#enumerate().size;
  }

  forEach(
    callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    this.#enumerate().forEach(callback, thisArg);
  }

  entries(): MapIterator<[K, V]> {
    return this.#enumerate().entries();
  }

  keys(): MapIterator<K> {
    return this.#enumerate().keys();
  }

  values(): MapIterator<V> {
    return this.#enumerate().values();
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.#enumerate()[Symbol.iterator]();
  }
}
