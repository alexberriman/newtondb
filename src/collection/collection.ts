import {
  asArray,
  isScalar,
  isSingleArray,
  objectOfProperties,
} from "../utils/types";
import {
  get as getByAdvancedCondition,
  query as queryByAdvancedCondition,
} from "../data/advanced-query";
import {
  get as getByBasicCondition,
  query as queryByBasicCondition,
} from "../data/basic-query";
import { createCondition, isFindPredicate } from "./utils";
import {
  type AdvancedCondition,
  isCondition as isAdvancedCondition,
} from "../data/advanced-query";
import { AssertionError } from "../errors/assertion-error";
import { HashTable, type HashTableItem } from "../data/hash-table";
import { Chain } from "./chain";

interface CollectionOptions<T, IndexKeys> {
  primaryKey?: IndexKeys | IndexKeys[];
  validatePrimaryKey?: boolean;
  indexes?: (keyof T)[][];
}

type AssertionFunction<DataType, IndexKeys extends keyof DataType, Index> = (
  arg0: Chain<DataType, IndexKeys, Index>
) => boolean;

export type FindPredicate<T, Y> = (
  value: T,
  index: number,
  array: Y[]
) => value is T;

export class Collection<
  T,
  IndexKeys extends keyof T,
  Index = Pick<T, IndexKeys>
> {
  primaryKey: IndexKeys[];
  hashTable: HashTable<T, IndexKeys, keyof T, Index, T>;

  constructor(
    data: T[],
    private options: CollectionOptions<T, IndexKeys> = {}
  ) {
    const { primaryKey } = options;

    this.primaryKey = primaryKey ? asArray(primaryKey) : [];
    this.hashTable = new HashTable(data, { keyBy: this.primaryKey });
  }

  get data(): T[] {
    return this.hashTable.data;
  }

  get nodes() {
    return this.hashTable.nodes;
  }

  private chain<C = T[]>(chain: Chain<T, IndexKeys, Index>) {
    return {
      // details of chain
      get data() {
        const { data, lastOperation } = chain;

        // if last operation was to `.get`, return a single node
        return (lastOperation?.operation === "get"
          ? data[0]
          : data) as unknown as C;
      },
      get nodes() {
        return chain.nodes;
      },
      count: chain.count,
      exists: chain.exists,

      // collection methods to chain
      assert: (
        assertionFnOrDescription:
          | AssertionFunction<T, IndexKeys, Index>
          | string,
        assertionFn?: AssertionFunction<T, IndexKeys, Index>
      ) => this.assert(chain, assertionFnOrDescription, assertionFn),
      commit: () => chain.commit(),
      delete: () => {
        const result = this.delete(chain);
        return result;
      },
      insert: (value: T | T[]) => this.insert(value, chain),
      get: (value: unknown) => this.get(value, chain),
      find: (value?: unknown) => this.find(value, chain),
      limit: (amount: number) => this.limit(amount, chain),
      offset: (amount: number) => this.offset(amount, chain),
      set: (value: Partial<T>) => this.set(value, chain),
    };
  }
  private $assert(
    assertion: AssertionFunction<T, IndexKeys, Index>,
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)
  ) {
    if (!assertion(chain)) {
      throw new AssertionError();
    }

    return this.chain(chain);
  }

  private assert(
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable),
    assertionFnOrDescription: AssertionFunction<T, IndexKeys, Index> | string,
    assertionFn?: AssertionFunction<T, IndexKeys, Index>
  ) {
    if (typeof assertionFnOrDescription === "function") {
      return this.$assert(assertionFnOrDescription, chain);
    }

    if (
      typeof assertionFnOrDescription === "string" &&
      typeof assertionFn === "function"
    ) {
      return this.$assert(assertionFn, chain);
    }

    // invalid argument, just chain
    return this.chain(chain);
  }

  private $find(
    value:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown,
    { mode }: { mode: "find" | "get" },
    chain: Chain<T, IndexKeys, Index>
  ): typeof this.hashTable.nodes {
    if (objectOfProperties<Index>(value, this.primaryKey as string[])) {
      // primary key was passed through - can pull directly from hash table
      // rather than iterate through the list
      return chain.hashTable.get(value, { asItem: false });
    }

    if (isScalar(value) && isSingleArray(this.primaryKey)) {
      // scalar value was passed through and collection has a single primary
      // key - can hit the hash table
      return chain.hashTable.get(
        {
          [this.primaryKey[0]]: value,
        } as unknown as Index,
        { asItem: false }
      );
    }

    // calling nodes on the chain creates an array from a linked list (o(n))
    // call this only after the hash table is known to be unusable
    const $nodes = chain.nodes;
    type Node = typeof $nodes[number];

    if (isFindPredicate<T, HashTableItem<Index, T>>(value)) {
      const predicate = (item: Node, index: number, obj: Node[]) => {
        return value(item.data, index, obj);
      };

      return mode === "get"
        ? asArray($nodes.find(predicate))
        : $nodes.filter(predicate);
    }

    const preProcessor = ({ data }: Node) => data;

    if (isAdvancedCondition(value)) {
      return mode === "get"
        ? asArray(getByAdvancedCondition($nodes, value, preProcessor))
        : queryByAdvancedCondition($nodes, value, preProcessor);
    }

    const basicFn =
      mode === "get" ? getByBasicCondition : queryByBasicCondition;

    return asArray(
      basicFn(
        $nodes,
        createCondition(value, { primaryKey: this.primaryKey }) as Partial<T>,
        preProcessor
      )
    );
  }

  get(
    value:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown,
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)
  ) {
    const items = this.$find(value, { mode: "get" }, chain);
    chain.update(items, { operation: "get", args: [value] });

    return this.chain<T>(chain);
  }

  find(
    value?:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown,
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)
  ) {
    const items = this.$find(value, { mode: "find" }, chain);
    chain.update(items, { operation: "find", args: [value] });

    return this.chain(chain);
  }

  set(
    value: Partial<T>,
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)
  ) {
    chain.set(value);

    return this.chain(chain);
  }

  delete(chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)) {
    chain.delete();

    return this.chain(chain);
  }

  insert(
    items: T | T[],
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)
  ) {
    chain.insert(items);

    return this.chain(chain);
  }

  limit(
    amount: number,
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)
  ) {
    chain.update(chain.nodes.slice(0, amount), {
      operation: "limit",
      args: [amount],
    });
    return this.chain(chain);
  }

  offset(
    amount: number,
    chain: Chain<T, IndexKeys, Index> = new Chain(this.hashTable)
  ) {
    chain.update(chain.nodes.slice(amount), {
      operation: "offset",
      args: [amount],
    });
    return this.chain(chain);
  }

  sort() {
    // @todo
  }

  expand() {
    // @todo
  }
}
