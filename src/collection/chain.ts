import { HashTable } from "../data/hash-table";

type Mutation = any; // @todo

interface HistoryItem {
  operation: any; // @todo
  args: any; // @todo
}

export class Chain<
  DataType,
  IndexKeys extends keyof DataType,
  Index = Pick<DataType, IndexKeys>
> {
  mutations: Mutation[] = [];
  history: HistoryItem[] = [];

  constructor(
    public hashTable: HashTable<
      DataType,
      IndexKeys,
      keyof DataType,
      Index,
      DataType
    >
  ) {}

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

  addMutation(mutation: Mutation) {
    this.mutations = [...this.mutations, mutation];
  }

  // accepts as input a set of nodes and creates a new hash table
  // the purpose of this is to create a mutable table that can be
  // changed without impacting the original until the chain is
  // committed.
  update(nodes: typeof this.hashTable.nodes, operation?: HistoryItem) {
    this.hashTable = new HashTable(nodes);

    if (operation) {
      this.history = [...this.history, operation];
    }
  }
}
