import { HashTable, type HashTableItem } from "../data/hash-table";
import { type Patch } from "../data/json-patch";
import { type FunctionKeys } from "../utils/types";
import { type Collection } from "./collection";

interface HistoryItem<DataType, IndexKeys extends keyof DataType, Index> {
  operation: FunctionKeys<Collection<DataType, IndexKeys, Index>>;
  args: unknown[];
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
  masterTable: HashTable<DataType, IndexKeys, keyof DataType, Index, DataType>;

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
    this.masterTable = this.masterTable.clone();
    this.masterTable.patch(mutations);

    // reset the rolling hash table so can start querying on it again
    this.hashTable = this.masterTable;

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
    this.hashTable = new HashTable(nodes, this.hashTable.options);
    if (operation) {
      this.history = [...this.history, operation];
    }
  }
}
