import isEqual from "lodash.isequal";
import { objectSubset } from "../utils/object";
import { isScalar, isSingleArray, objectOfProperties } from "../utils/types";

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

interface HashTableItem<Index, DataItem> {
  index: Index | string;
  data: DataItem;
  previous: HashTableItem<Index, DataItem> | null;
  next: HashTableItem<Index, DataItem> | null;
}

function createHash(hash: unknown) {
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
  private tail: HashTableItem<Index, DataItem> | null = null;
  private head: HashTableItem<Index, DataItem> | null = null;

  constructor(
    items: Data[],
    public options: HashTableOptions<IndexKeys, StorageKeys> = {}
  ) {
    items.forEach(this.insert.bind(this));
  }

  // convert linked list to array
  get data() {
    const data = [];
    let node = this.tail;
    while (node !== null) {
      data.push(node.data);
      node = node.next;
    }

    return data;
  }

  private createItem(item: Data) {
    const { keyBy, properties } = this.options;
    const index = keyBy
      ? (objectSubset(item, keyBy) as unknown as Index)
      : this.size.toString();
    const hash = createHash(index as string | Record<string, unknown>);
    const data =
      Array.isArray(properties) && properties.length > 0
        ? objectSubset(item, properties)
        : item;

    return { data, hash, index };
  }

  private getByHash(hash: string) {
    return (this.table[hash] ?? []).map(({ data }) => data);
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

  insert(item: Data) {
    const { data, hash, index } = this.createItem(item);

    const node = {
      index,
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

  get(index: Index | number | string): DataItem[] {
    const { keyBy } = this.options;

    if (isScalar(index) && isSingleArray(keyBy)) {
      // have a single attribute for a key, can infer lookup key from scalar
      return this.getByHash(createHash({ [keyBy[0]]: index }));
    }

    return this.getByHash(
      createHash(index as string | number | Record<string, unknown>)
    );
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
}
