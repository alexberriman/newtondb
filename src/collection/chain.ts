import { HashTable, type HashTableItem } from "../data/hash-table";
import {
  createPartialPatch,
  createPatch,
  RemoveOperation,
  TestAddReplaceOperation,
  toPointer,
  type Patch,
} from "../data/json-patch";
import { flatten } from "../utils/array";
import { objectSubset } from "../utils/object";
import { asArray, isCallable, type FunctionKeys } from "../utils/types";
import { type Collection } from "./collection";

interface HistoryItem<DataType, IndexKeys extends keyof DataType, Index> {
  operation: FunctionKeys<Collection<DataType, IndexKeys, Index>>;
  args: unknown[];
}

export interface CommitResult {
  mutations: Patch;
}

export class Chain<
  DataType,
  IndexKeys extends keyof DataType,
  SelectKeys extends keyof DataType = keyof DataType,
  Index = Pick<DataType, IndexKeys>,
  SelectItem = Pick<DataType, SelectKeys>
> {
  mutations: Patch = [];
  history: HistoryItem<DataType, IndexKeys, Index>[] = [];

  // used to make rolling changes (such as .find() etc.)
  // @todo rename
  // hashTable: HashTable<DataType, IndexKeys, keyof DataType, Index, DataType>;

  // the master table is the source of truth that contains all of the data items
  // it is only updated when .commit() is called
  masterTable: HashTable<DataType, IndexKeys, keyof DataType, Index, DataType>;

  // the mutable table is what is updated when mutable functions are executed
  // (.delete(), .set(), .update()). Mutable table changes are committed to the
  // master table when `.commit()` is called
  mutableTable: HashTable<DataType, IndexKeys, keyof DataType, Index, DataType>;

  constructor(
    public hashTable: HashTable<
      DataType,
      IndexKeys,
      keyof DataType,
      Index,
      DataType
    >,
    public options: { properties?: SelectKeys[] } = {}
  ) {
    this.masterTable = hashTable;
    this.mutableTable = hashTable;
  }

  get data(): SelectItem[] {
    const properties = asArray(this.options.properties);

    const { data } = this.hashTable;
    if (properties.length === 0) {
      return data as unknown as SelectItem[];
    }

    return data.map((item) =>
      objectSubset(item, properties)
    ) as unknown as SelectItem[];
  }

  get nodes() {
    return this.hashTable.nodes;
  }

  get count() {
    return this.hashTable.size;
  }

  get exists() {
    return this.hashTable.size > 0;
  }

  get lastOperation() {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : null;
  }

  mutate(mutations: Patch) {
    // when mutating the hash table, first need to clone it so the original
    // table isn't changed. the original table should only be mutated
    // when the chain mutations are committed.
    this.mutableTable = this.mutableTable.clone();
    this.mutableTable.patch(mutations);

    // reset the rolling hash table so can start querying on it again
    this.hashTable = this.mutableTable;

    this.mutations = [...this.mutations, ...mutations];
  }

  // accepts as input a set of nodes and creates a new hash table
  // the purpose of this is to create a mutable table that can be
  // changed without impacting the original until the chain is
  // committed.
  update(
    nodes: HashTableItem<Index, DataType>[],
    operation?: HistoryItem<DataType, IndexKeys, Index>
  ) {
    // since not mutating can create a shallow clone
    const { latestId } = this.hashTable; // @todo create shallowClone()
    this.hashTable = new HashTable(nodes, this.hashTable.options);
    this.hashTable.latestId = latestId;

    if (operation) {
      this.history = [...this.history, operation];
    }
  }

  delete() {
    const mutations = flatten(
      this.hashTable.nodes.map(({ hash, $id }) => [
        { op: "remove", path: toPointer(hash, $id) },
      ])
    ) as RemoveOperation[];

    this.mutate(mutations);
  }

  insert(item: DataType | DataType[]) {
    const mutations = asArray(item).map((item) => {
      const node = this.hashTable.toNode(item);

      return {
        op: "add",
        path: toPointer(node.hash),
        value: item as unknown as object,
      } as TestAddReplaceOperation;
    });

    this.mutate(mutations);
  }

  private setOrReplace(
    updateFnOrObject:
      | DataType
      | Partial<DataType>
      | ((item: DataType) => Partial<DataType>)
      | ((item: DataType) => DataType),
    patchFn: typeof createPartialPatch | typeof createPatch
  ) {
    const mutations = flatten(
      this.hashTable.nodes
        .map((node) => {
          const updated = isCallable<
            (arg0: DataType) => DataType | Partial<DataType>
          >(updateFnOrObject)
            ? updateFnOrObject(node.data)
            : updateFnOrObject;

          return patchFn(node.data as unknown as object, updated, [
            node.hash,
            node.$id,
          ]);
        })
        .filter((operations) => operations.length > 0)
    );

    if (mutations.length > 0) {
      this.mutate(mutations);
    }
  }

  set(
    update:
      | Partial<DataType>
      | ((item: DataType) => DataType | Partial<DataType>)
  ) {
    return this.setOrReplace(update, createPartialPatch);
  }

  replace(document: DataType | ((item: DataType) => DataType)) {
    return this.setOrReplace(document, createPatch);
  }

  commit(): CommitResult {
    this.masterTable.patch(this.mutations);

    return { mutations: this.mutations };
  }

  cloneForProperties<K extends keyof DataType>(properties: K[]) {
    // @todo lol
    const $chain = new Chain(this.hashTable, { properties });
    $chain.history = this.history;
    $chain.mutations = this.mutations;
    $chain.masterTable = this.masterTable;
    $chain.mutableTable = this.mutableTable;

    return $chain;
  }
}
