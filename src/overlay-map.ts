/** Bounded-depth copy-on-write map used for transaction working sets. */
export class OverlayMap<K, V> implements ReadonlyMap<K, V> {
  readonly #base: ReadonlyMap<K, V>;
  readonly #deletions = new Set<K>();
  readonly #updates = new Map<K, V>();
  readonly depth: number;
  #sealed = false;
  #size: number;

  constructor(base: ReadonlyMap<K, V>) {
    this.#base = base;
    this.#size = base.size;
    this.depth = base instanceof OverlayMap ? base.depth + 1 : 1;
  }

  get size(): number {
    return this.#size;
  }

  get changedCount(): number {
    return this.#deletions.size + this.#updates.size;
  }

  delete(key: K): boolean {
    this.#assertMutable();
    if (!this.has(key)) return false;
    this.#updates.delete(key);
    this.#deletions.add(key);
    this.#size -= 1;
    return true;
  }

  get(key: K): V | undefined {
    if (this.#updates.has(key)) return this.#updates.get(key);
    if (this.#deletions.has(key)) return undefined;
    return this.#base.get(key);
  }

  has(key: K): boolean {
    return (
      this.#updates.has(key) ||
      (!this.#deletions.has(key) && this.#base.has(key))
    );
  }

  set(key: K, value: V): this {
    this.#assertMutable();
    const existed = this.has(key);
    this.#deletions.delete(key);
    this.#updates.set(key, value);
    if (!existed) this.#size += 1;
    return this;
  }

  seal(): Map<K, V> | OverlayMap<K, V> {
    this.#sealed = true;
    const compactThreshold = Math.max(256, Math.ceil(this.#base.size / 4));
    return this.depth >= 32 || this.changedCount >= compactThreshold
      ? new Map(this)
      : this;
  }

  entries(): MapIterator<[K, V]> {
    return this.#iterateEntries();
  }

  keys(): MapIterator<K> {
    return this.#iterateKeys();
  }

  values(): MapIterator<V> {
    return this.#iterateValues();
  }

  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this) callbackfn.call(thisArg, value, key, this);
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }

  *#iterateEntries(): MapIterator<[K, V]> {
    for (const [key, baseValue] of this.#base) {
      if (this.#deletions.has(key)) continue;
      yield [
        key,
        this.#updates.has(key) ? (this.#updates.get(key) as V) : baseValue,
      ];
    }
    for (const [key, value] of this.#updates) {
      if (!this.#base.has(key)) yield [key, value];
    }
  }

  *#iterateKeys(): MapIterator<K> {
    for (const [key] of this) yield key;
  }

  *#iterateValues(): MapIterator<V> {
    for (const [, value] of this) yield value;
  }

  #assertMutable(): void {
    if (this.#sealed) throw new Error("A committed overlay map is immutable");
  }
}
