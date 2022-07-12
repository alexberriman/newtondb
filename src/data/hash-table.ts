import cloneDeep from "lodash.clonedeep";
import isEqual from "lodash.isequal";
import { shallowEqual } from "../utils/array";
import { objectSubset } from "../utils/object";
import {
  isObject,
  isPopulatedArray,
  isScalar,
  isSingleArray,
  objectOfProperties,
} from "../utils/types";

interface HashTableOptions<IndexKeys, StorageKeys> {
  // need a key to generate a hash against for quick access
  // when a key is omitted, the array index will be used.
  keyBy?: IndexKeys[];

  // by default, the entire item will be stored against the hash
  // however, you can optionally pass through an array of keys
  // to store a subset of the data.
  //
  // this can be useful when creating secondary indexes and
  // you want to simply store the primary key against the
  // index rather than the entire piece of data
  properties?: StorageKeys[];
}

export interface HashTableItem<Index, DataItem> {
  index: Index | string;
  hash: string;
  data: DataItem;
  previous: HashTableItem<Index, DataItem> | null;
  next: HashTableItem<Index, DataItem> | null;
}

// @todo move to util
function isHashTableItem<Index, DataItem>(
  value: unknown
): value is HashTableItem<Index, DataItem> {
  return (
    isObject(value) &&
    shallowEqual(Object.keys(value), [
      "index",
      "hash",
      "data",
      "previous",
      "next",
    ])
  );
}

export function createHash(hash: unknown) {
  return typeof hash === "string" ? hash : JSON.stringify(hash);
}

export class HashTable<
  Data,
  IndexKeys extends keyof Data,
  StorageKeys extends keyof Data = keyof Data,
  Index = Pick<Data, IndexKeys>,
  DataItem = Pick<Data, StorageKeys>
> {
  size = 0;
  table: Record<string, HashTableItem<Index, DataItem>[]> = {};

  // doubly linked list to be able to convert between array and hash map
  tail: HashTableItem<Index, DataItem> | null = null;
  head: HashTableItem<Index, DataItem> | null = null;

  constructor(items: HashTableItem<Index, DataItem>[]);
  constructor(
    items: Data[],
    options?: HashTableOptions<IndexKeys, StorageKeys>
  );
  constructor(
    items: (Data | HashTableItem<Index, DataItem>)[],
    public options: HashTableOptions<IndexKeys, StorageKeys> = {}
  ) {
    items.forEach(this.$insert.bind(this));
  }

  // convert linked list to array
  private toArray<T = HashTableItem<Index, DataItem>>(
    transformer?: (node: HashTableItem<Index, DataItem>) => T
  ): T[] {
    const data = [];
    let node = this.tail;
    while (node !== null) {
      data.push(transformer ? transformer(node) : node);
      node = node.next;
    }

    return data as unknown as T[];
  }

  // return data
  get data() {
    return this.toArray<DataItem>(({ data }) => data);
  }

  // return raw nodes
  get nodes() {
    return this.toArray();
  }

  private createItem(item: Data) {
    const { keyBy, properties } = this.options;
    const index = isPopulatedArray(keyBy)
      ? (objectSubset(item, keyBy) as unknown as Index)
      : (Number(this.head?.index ?? "-1") + 1).toString(); // auto incrementing ids as index
    const hash = createHash(index as string | Record<string, unknown>);
    const data =
      Array.isArray(properties) && properties.length > 0
        ? objectSubset(item, properties)
        : item;

    return { data: data as unknown as DataItem, hash, index };
  }

  private getByHash(hash: string) {
    return this.table[hash] ?? [];
  }

  private deleteItem(
    item: HashTableItem<Index, DataItem>,
    hash: string,
    index: number
  ) {
    const { previous, next } = item;

    // update items to the left and right in the linked list to prepare for delete
    if (previous) {
      previous.next = next;
    } else {
      // was the first item in the linked list, have to update the tail to the next item
      this.tail = next;
    }

    if (next) {
      next.previous = previous;
    } else {
      // was the last item in the linked list, have to update the head to the previous
      this.head = previous;
    }

    if (this.table[hash].length === 1) {
      // delete the entire hash when this is the only item
      delete this.table[hash];
    } else {
      // delete a single item from the hash table
      this.table[hash].splice(index, 1);
    }

    --this.size;
  }

  private deleteByIndex(
    index: Index | string | number,
    predicate?: (item: DataItem) => boolean
  ) {
    const hash = createHash(index);
    if (this.table[hash]) {
      if (!predicate) {
        [...this.table[hash]].forEach((item, index) =>
          this.deleteItem(item, hash, index)
        );
      } else {
        [...this.table[hash]]
          .filter(({ data }) => predicate(data))
          .map((item, index) => this.deleteItem(item, hash, index));
      }
    }
  }

  private insertItem(data: DataItem, hash: string, index: string | Index) {
    const node = {
      index,
      hash,
      data: data as unknown as DataItem,
      previous: this.head,
      next: null,
    };
    this.table[hash] = [...(this.table[hash] ?? []), node];

    if (this.head) {
      // update current head to point to newly created node
      this.head.next = node;
    }

    if (!this.tail) {
      // set tail if not exist
      this.tail = node;
    }

    this.head = node;
    ++this.size;
  }

  private $insert(item: Data | HashTableItem<Index, DataItem>) {
    if (isHashTableItem<Index, DataItem>(item)) {
      // insert hash table item
      const { data, hash, index } = item;
      return this.insertItem(data, hash, index); // @todo might need to deep clone
    }

    this.insert(item);
  }

  insert(item: Data) {
    const { data, hash, index } = this.createItem(item);
    this.insertItem(data, hash, index);
  }

  get(index: Index | number | string): DataItem[];
  get(index: Index | number | string, options: { asItem: true }): DataItem[];
  get(
    index: Index | number | string,
    options: { asItem: false }
  ): HashTableItem<Index, DataItem>[];
  get(
    index: Index | number | string,
    options: { asItem: boolean } = { asItem: true }
  ): DataItem[] | HashTableItem<Index, DataItem>[] {
    const { asItem } = options;
    const { keyBy } = this.options;

    const items =
      isScalar(index) && isSingleArray(keyBy)
        ? // have a single attribute for a key, can infer lookup key from scalar
          this.getByHash(createHash({ [keyBy[0]]: index }))
        : // index was passed through
          this.getByHash(
            createHash(index as string | number | Record<string, unknown>)
          );

    return asItem ? items.map(({ data }) => data) : items;
  }

  delete(item: Data): void;
  delete(
    index: Index | string | number,
    predicate?: (item: DataItem) => boolean
  ): void;
  delete(
    itemOrIndex: Data | Index | string | number,
    predicate?: (item: DataItem) => boolean
  ) {
    const { keyBy = [] } = this.options;

    if (isScalar(itemOrIndex)) {
      if (isSingleArray(keyBy)) {
        // passed through a scalar (of which we can infer an index)
        return this.deleteByIndex(
          { [keyBy[0]]: itemOrIndex } as unknown as Index,
          predicate
        );
      }

      // delete by scalar
      return this.deleteByIndex(itemOrIndex, predicate);
    }

    if (objectOfProperties<Index>(itemOrIndex, keyBy as string[])) {
      // passed through an index
      return this.deleteByIndex(itemOrIndex, predicate);
    }

    // the entire data object was passed through, delete (can delete by data even if not indexed)
    const { data, hash } = this.createItem(itemOrIndex);
    const index = (this.table[hash] ?? []).findIndex((item) =>
      isEqual(item.data, data)
    );
    if (index >= 0) {
      this.deleteItem(this.table[hash][index], hash, index);
    }
  }

  clone() {
    // @todo more efficient don't rely on cloneDeep
    // create a clone of the hash table
    const $nodes = cloneDeep(this.nodes);
    return new HashTable($nodes);
  }

  patch() {
    // @todo apply patches
  }
}
