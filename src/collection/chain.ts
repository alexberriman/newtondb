import { orderBy } from "lodash";
import { HashTable, type HashTableItem } from "../data/hash-table/table";
import {
  createPartialPatch,
  createPatch,
  type PatchOperation,
  type RemoveOperation,
  type TestAddReplaceOperation,
  toPointer,
  type Patch,
} from "../data/json-patch";
import { flatten } from "../utils/arrays";
import { subset } from "../utils/objects";
import {
  asArray,
  isCallable,
  isPopulatedArray,
  type FunctionKeys,
} from "../utils/types";
import { type Collection } from "./collection";
import { createEvents, type MutationEvent } from "./observer";

export interface HistoryItem<
  DataType,
  IndexKeys extends keyof DataType,
  Index
> {
  operation: FunctionKeys<Collection<DataType, IndexKeys, Index>>;
  args: unknown[];
}

export interface CommitResult<
  DataType,
  IndexKeys extends keyof DataType,
  Index
> {
  history: HistoryItem<DataType, IndexKeys, Index>[];
  mutations: Patch;
  events: MutationEvent<DataType>[];
}

export class Chain<
  DataType,
  IndexKeys extends keyof DataType,
  SelectKeys extends keyof DataType = keyof DataType,
  Index = Pick<DataType, IndexKeys>,
  SelectItem = Pick<DataType, SelectKeys>
> {
  order?: Partial<Record<keyof DataType, "asc" | "desc">>;
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
    public options: {
      properties?: SelectKeys[];
      orderBy?: Partial<Record<keyof DataType, "asc" | "desc">>;
    } = {}
  ) {
    const { orderBy } = options;
    this.masterTable = hashTable;
    this.mutableTable = hashTable;

    if (orderBy) {
      this.order = orderBy;
    }
  }

  get data(): SelectItem[] {
    const data = this.order
      ? orderBy(
          this.hashTable.data,
          Object.keys(this.order),
          Object.values(this.order)
        )
      : this.hashTable.data;

    const properties = asArray(this.options.properties);
    if (properties.length === 0) {
      return data as unknown as SelectItem[];
    }

    return data.map((item) =>
      subset(item, properties)
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

  private addToHistory(operation?: HistoryItem<DataType, IndexKeys, Index>) {
    if (operation) {
      this.history = [...this.history, operation];
    }
  }

  private mutate(mutations: Patch) {
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

    this.addToHistory(operation);
  }

  delete() {
    const mutations = flatten<RemoveOperation>(
      this.hashTable.nodes.map(({ hash, $id }) => [
        { op: "remove", path: toPointer(hash, $id) },
      ])
    );

    this.addToHistory({ operation: "delete", args: [] });
    this.mutate(mutations);
  }

  insert(items: DataType | DataType[]) {
    const hasIndex = isPopulatedArray(this.hashTable.options.keyBy);
    const mutations = asArray(items).map((item, index) => {
      const node = this.hashTable.toNode(item);

      // if no index is set on the hash table, an auto incrementing id is used
      // as the index. in this case, need to auto increment before committing
      const path = hasIndex ? node.hash : this.hashTable.latestId + index;

      return {
        op: "add",
        path: toPointer(path),
        value: item as unknown as object,
      } as TestAddReplaceOperation;
    });

    this.addToHistory({ operation: "insert", args: [items] });
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
    const mutations = flatten<PatchOperation>(
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
    this.addToHistory({ operation: "set", args: [update] });
    return this.setOrReplace(update, createPartialPatch);
  }

  replace(document: DataType | ((item: DataType) => DataType)) {
    this.addToHistory({ operation: "replace", args: [document] });
    return this.setOrReplace(document, createPatch);
  }

  commit(): CommitResult<DataType, IndexKeys, Index> {
    const mutationResults = this.masterTable.patch(this.mutations);
    const events = createEvents(
      mutationResults,
      ($id) => this.masterTable.items[$id].data
    );

    return {
      history: this.history,
      mutations: this.mutations,
      events,
    };
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

  orderBy(order: Partial<Record<keyof DataType, "asc" | "desc">>) {
    this.order = order;
    this.addToHistory({ operation: "orderBy", args: [order] });
  }
}
