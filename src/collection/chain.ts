import { HashTable, type HashTableItem } from "../data/hash-table";
import {
  createUpdateOperations,
  RemoveOperation,
  TestAddReplaceOperation,
  toPointer,
  type Patch,
} from "../data/json-patch";
import { flatten } from "../utils/array";
import { asArray, type FunctionKeys } from "../utils/types";
import { type Collection } from "./collection";

interface HistoryItem<DataType, IndexKeys extends keyof DataType, Index> {
  operation: FunctionKeys<Collection<DataType, IndexKeys, Index>>;
  args: unknown[];
}

interface CommitResult {
  mutations: Patch;
}

export class Chain<
  DataType,
  IndexKeys extends keyof DataType,
  Index = Pick<DataType, IndexKeys>
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
    >
  ) {
    this.masterTable = hashTable;
    this.mutableTable = hashTable;
  }

  get data() {
    return this.hashTable.data;
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

  set(update: Partial<DataType>) {
    const mutations = flatten(
      this.hashTable.nodes
        .map((node) =>
          createUpdateOperations(node.data, update, [node.hash, node.$id])
        )
        .filter((operations) => operations.length > 0)
    );

    if (mutations.length > 0) {
      this.mutate(mutations);
    }
  }

  commit(): CommitResult {
    this.masterTable.patch(this.mutations);

    return { mutations: this.mutations };
  }
}
