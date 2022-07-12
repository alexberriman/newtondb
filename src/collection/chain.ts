import { applyPatch } from "rfc6902";
import { HashTable, type HashTableItem } from "../data/hash-table";
import { asArray, FunctionKeys } from "../utils/types";
import { type Collection } from "./collection";

type Mutation = any; // @todo

interface HistoryItem<DataType, IndexKeys extends keyof DataType, Index> {
  operation: FunctionKeys<Collection<DataType, IndexKeys, Index>>;
  args: unknown[];
}

export class Chain<
  DataType,
  IndexKeys extends keyof DataType,
  Index = Pick<DataType, IndexKeys>
> {
  mutations: Mutation[] = [];
  history: HistoryItem<DataType, IndexKeys, Index>[] = [];

  // used to make rolling changes (such as .find() etc.)
  // @todo rename
  hashTable: HashTable<DataType, IndexKeys, keyof DataType, Index, DataType>;

  // the 'master' table is the source of truth that contains all of the data items
  // it is updated on mutatable chain calls (such as .delete() and .set()) so you can
  // perform sequential mutatable/non-mutatable prior to committing.
  //
  // for example:
  // $
  //  .find({ house: "gryffindor" }) // find all gryffindor students from original data source
  //  .assert(({ count }) => count > ) // will return `true` as there are students from gryffindor in the db
  //  .delete() // will delete gryffindor students
  //  .find({ house: "gryffindor" })
  //  .assert(({ count }) => count === 0) // will return `true` since the above `delete` mutation has been applied to master
  //
  // in the above example, gryffindor students were deleted (and a new master hash table was generated)
  // however the chain wasn't committed so the original data source remains in tact.
  master: HashTable<DataType, IndexKeys, keyof DataType, Index, DataType>;

  constructor(
    public original: HashTable<
      DataType,
      IndexKeys,
      keyof DataType,
      Index,
      DataType
    >
  ) {
    this.hashTable = original.clone();
    this.master = original.clone();
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

  mutate(mutations: Mutation | Mutation[]) {
    // @todo: apply patches to a hash table
    applyPatch(this.master.table, asArray(mutations));
    this.hashTable = this.master.clone();
    this.mutations = [...this.mutations, ...asArray(mutations)];
  }

  // accepts as input a set of nodes and creates a new hash table
  // the purpose of this is to create a mutable table that can be
  // changed without impacting the original until the chain is
  // committed.
  update(
    nodes: HashTableItem<Index, DataType>[],
    operation?: HistoryItem<DataType, IndexKeys, Index>
  ) {
    this.hashTable = new HashTable(nodes);

    if (operation) {
      this.history = [...this.history, operation];
    }
  }
}
