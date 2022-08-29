import { PatchError } from "../../errors/patch-error";
import { flatten, shallowEqual } from "../../utils/arrays";
import { cloneDeep, dot, isEqual, set, unset } from "../../utils/collections";
import { subset } from "../../utils/objects";
import {
  isObject,
  isObjectOfProperties,
  isPopulatedArray,
  isScalar,
  isSingleArray,
} from "../../utils/types";
import {
  type Patch,
  type RemoveOperation,
  type TestAddReplaceOperation,
  toTokens,
} from "../json-patch";
import type {
  PatchAddResult,
  PatchRemoveResult,
  PatchResult,
  ReplaceResult,
} from "./patch";

// Map <Index(string), items[]>

// @todo freeze data

export interface HashTableOptions<IndexKeys, StorageKeys> {
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

  // order in the hash array. If using the primary key as the index,
  // each hash table entry (which is an array) should only contain
  // a single node, since the primary key should uniquely identify
  // the record. However, if using a non-unique key as the index
  // (e.g. creating a secondary key for faster reads), the hash array
  // will contain multiple records. Storing the order within the array
  // at write time will allow instant retrieval from the hash table
  // during reads.
  $order: number;

  // each node needs an internal unique identifier (so using an auto
  // incrementing number) to uniquely identify a node when generating
  // and executing chained mutations.
  $id: number;
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
      "$id",
      "$order",
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
  latestId = 0;
  size = 0;
  table: Record<string, HashTableItem<Index, DataItem>[]> = {};
  items: Map<number, HashTableItem<Index, DataItem>> = new Map();
  // items: Record<string, HashTableItem<Index, DataItem>> = {}; // @todo make private

  // doubly linked list to be able to convert between array and hash map
  tail: HashTableItem<Index, DataItem> | null = null;
  head: HashTableItem<Index, DataItem> | null = null;

  constructor(
    items: HashTableItem<Index, DataItem>[],
    options?: HashTableOptions<IndexKeys, StorageKeys>
  );
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

  toNode(item: Data) {
    const { keyBy, properties } = this.options;
    const index = isPopulatedArray(keyBy)
      ? (subset(item, keyBy) as unknown as Index)
      : this.latestId.toString(); // auto incrementing ids as index
    const hash = createHash(index as string | Record<string, unknown>);
    const data =
      Array.isArray(properties) && properties.length > 0
        ? subset(item, properties)
        : item;

    return { data: data as unknown as DataItem, hash, index };
  }

  private getByHash(hash: string) {
    return this.table[hash] ?? [];
  }

  // resizes a hash by re-setting the $order attribute after
  // an item has been deleted
  private resize(hash: string, from: number) {
    const entry = this.table[hash];

    if (entry && entry.length >= from) {
      for (let index = from; index < entry.length; index++) {
        this.table[hash][index].$order = index;
      }
    }
  }

  private deleteItem(item: HashTableItem<Index, DataItem>) {
    const { hash, $id } = item;
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

    // fetch node from current table (node passed through may have been cloned with different options)
    const $node = this.items.get($id);

    // delete a single item from the hash table
    if ($node) {
      this.items.delete($id);
      delete this.table[hash][$node.$order];
      this.table[hash].splice($node.$order, 1);

      if (this.table[hash].length === 0) {
        delete this.table[hash];
      }

      this.resize(hash, $node.$order);

      --this.size;
    }
  }

  private deleteByIndex(
    index: Index | string | number,
    predicate?: (item: DataItem) => boolean
  ) {
    const hash = createHash(index);
    if (this.table[hash]) {
      if (!predicate) {
        [...this.table[hash]].forEach((item) => this.deleteItem(item));
      } else {
        [...this.table[hash]]
          .filter(({ data }) => predicate(data))
          .forEach((item) => this.deleteItem(item));
      }
    }
  }

  private insertItem(
    data: DataItem,
    hash: string,
    index: string | Index,
    $id?: number
  ) {
    const currentValue = this.table[hash] ?? [];
    const node = {
      index,
      hash,
      data: data as unknown as DataItem,
      previous: this.head,
      next: null,
      $id: $id ?? this.latestId,
      $order: currentValue.length,
    };
    this.table[hash] = [...currentValue, node];

    if (this.head) {
      // update current head to point to newly created node
      this.head.next = node;
    }

    if (!this.tail) {
      // set tail if not exist
      this.tail = node;
    }

    this.head = node;
    this.items.set(node.$id, node);

    ++this.latestId;
    ++this.size;

    return node.$id;
  }

  private $insert(item: Data | HashTableItem<Index, DataItem>) {
    if (isHashTableItem<Index, DataItem>(item)) {
      // insert hash table item
      const { data, hash, index, $id } = item;
      return this.insertItem(data, hash, index, $id); // @todo might need to deep clone
    }

    return this.insert(item);
  }

  insert(item: Data) {
    const { data, hash, index } = this.toNode(item);
    return this.insertItem(data, hash, index);
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
      return this.deleteByIndex(
        itemOrIndex as string | number | Index,
        predicate
      );
    }

    if (isObjectOfProperties<Index>(itemOrIndex, keyBy as string[])) {
      // passed through an index
      return this.deleteByIndex(itemOrIndex, predicate);
    }

    // the entire data object was passed through, delete (can delete by data even if not indexed)
    const { data, hash } = this.toNode(itemOrIndex);
    const index = (this.table[hash] ?? []).findIndex((item) =>
      isEqual(item.data, data)
    );
    if (index >= 0) {
      this.deleteItem(this.table[hash][index]);
    }
  }

  clone() {
    // @todo more efficient don't rely on cloneDeep
    const $nodes = this.nodes.map((node) => ({
      ...node,
      // clone data to break reference to original object
      data: cloneDeep(node.data),
      // reset the linked list references temporarily to `null`
      previous: null,
      next: null,
    })) as typeof this.nodes;

    // re-build the linked list references to the newly created objects
    $nodes.forEach((node, index) => {
      if (index > 0) {
        node.previous = $nodes[index - 1];
      }
      if (index < $nodes.length - 1) {
        node.next = $nodes[index + 1];
      }
    });

    const cloned = new HashTable<Data, IndexKeys, StorageKeys, Index, DataItem>(
      $nodes,
      { ...this.options }
    );
    cloned.latestId = this.latestId;

    return cloned;
  }

  // could either be removing a single node attribute, or an entire node, or even
  // an entire hash
  private $patchRemove(
    operation: RemoveOperation
  ): PatchRemoveResult<DataItem> | PatchRemoveResult<DataItem>[] {
    const [hash, id, ...attributePath] = toTokens(operation.path);

    if (id) {
      const $id = Number(id);
      const node = this.items.get($id);
      if (!node) {
        throw new PatchError(operation, "Node does not exist");
      }

      const original = cloneDeep(node.data);
      if (attributePath.length > 0) {
        const attribute = attributePath.join(".");
        unset(node.data, attribute);
        this.items.set($id, node);

        return {
          operation: "removeAttribute",
          $id,
          original,
          attribute,
        };
      } else {
        this.deleteItem(node);

        return {
          operation: "remove",
          $id,
          original,
          value: original,
        };
      }
    }

    // delete an entire hash
    if (hash && this.table[hash]) {
      return this.table[hash].map((node) => {
        const original = cloneDeep(node.data);
        this.deleteItem(node);

        return {
          operation: "remove",
          $id: Number(id),
          original,
          value: original,
        };
      });
    }

    throw new PatchError(operation, "Invalid operation");
  }

  // could be adding a new node (entire object), or a new attribute to an existing node
  private $patchAdd(
    operation: TestAddReplaceOperation
  ): PatchAddResult<DataItem> {
    const { value } = operation;
    const [, id, ...path] = toTokens(operation.path);
    const $id = Number(id);
    const node = this.items.get($id);

    if (!isNaN($id) && node && path.length > 0) {
      // adding a new attribute to an existing node
      const attribute = path.join(".");
      const original = cloneDeep(node.data);
      set(node.data as unknown as object, attribute, value);

      return {
        operation: "addAttribute",
        $id,
        original,
        attribute,
        value,
      };
    }

    if (isNaN($id) && isObject(value)) {
      const $id = this.insert(value as unknown as Data);
      return {
        operation: "add",
        $id,
        original: value as DataItem,
        value: value as DataItem,
      };
    }

    throw new PatchError(operation, "Invalid data value");
  }

  private $patchReplace(
    operation: TestAddReplaceOperation
  ): ReplaceResult<DataItem> {
    const [, id, ...path] = toTokens(operation.path);
    const $id = Number(id);
    const node = this.items.get($id);
    if (!node) {
      throw new PatchError(operation, "Node does not exist");
    }

    // use dot notation to set nested data structures
    const original = cloneDeep(node.data);
    const attribute = path.join(".");
    const oldValue = dot(node.data as Record<string, unknown>, attribute);
    set(node.data, attribute, operation.value);

    return {
      operation: "replaceAttribute",
      $id,
      original,
      attribute,
      value: operation.value,
      oldValue,
    };
  }

  patch(operations: Patch): PatchResult<DataItem>[] {
    return flatten<PatchResult<DataItem>>(
      operations.map((operation) => {
        const { op } = operation;
        if (op === "remove") {
          return this.$patchRemove(operation);
        }

        if (op === "add") {
          return this.$patchAdd(operation);
        }

        if (op === "replace") {
          return this.$patchReplace(operation);
        }

        return null;
      })
    );
  }
}
