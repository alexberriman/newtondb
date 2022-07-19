import {
  asArray,
  isCallable,
  isScalar,
  isSingleArray,
  objectOfProperties,
  Subset,
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
import { Chain, type CommitResult } from "./chain";
import { cloneDeep } from "lodash";
import { findLast } from "../utils/array";
import type {
  DeleteObserver,
  GenericObserver,
  InsertObserver,
  UpdateObserver,
  Observers,
  MutationEvent,
  ObserverEvent,
} from "./observer";
import { ObserverError } from "../errors/observer-error";

export interface CollectionOptions<IndexKeys> {
  primaryKey?: IndexKeys | IndexKeys[];

  // by default, the data object that is initially passed in is mutated when
  // changes are committed. Setting `copy` to `true` creates a deep clone of
  // the data on instantiation so the original array of objects isn't mutated
  copy?: boolean;
}

type AssertionFunction<
  DataType,
  IndexKeys extends keyof DataType,
  Properties extends keyof DataType,
  Index
> = (arg0: Chain<DataType, IndexKeys, Properties, Index>) => boolean;

export type FindPredicate<T, Y> = (
  value: T,
  index: number,
  array: Y[]
) => value is T;

export class Collection<
  T,
  IndexKeys extends keyof T = keyof T,
  Index = Pick<T, IndexKeys>
> {
  primaryKey: IndexKeys[];
  hashTable: HashTable<T, IndexKeys, keyof T, Index, T>;
  observers: Observers<T> = { insert: [], update: [], delete: [], "*": [] };
  observer = 0;

  constructor(data: T[], private options: CollectionOptions<IndexKeys> = {}) {
    const { copy, primaryKey } = options;

    this.primaryKey = primaryKey ? asArray(primaryKey) : [];
    this.hashTable = new HashTable(copy ? cloneDeep(data) : data, {
      keyBy: this.primaryKey,
    });
  }

  get data(): T[] {
    return this.hashTable.data;
  }

  get nodes() {
    return this.hashTable.nodes;
  }

  private chain<DataResponse, Properties extends keyof T>(
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    return {
      // details of chain
      get data(): DataResponse {
        const { data, history } = chain;
        const lastOperation = findLast(
          history,
          ({ operation }) => operation === "find" || operation === "get"
        );

        if (lastOperation?.operation === "get") {
          return data[0] as unknown as DataResponse;
        }

        return data as unknown as DataResponse;
      },
      get nodes() {
        return chain.nodes;
      },
      count: chain.count,
      exists: chain.exists,
      chain,

      // collection methods to chain
      assert: (
        assertionFnOrDescription:
          | AssertionFunction<T, IndexKeys, Properties, Index>
          | string,
        assertionFn?: AssertionFunction<T, IndexKeys, Properties, Index>
      ) => this.assert(chain, assertionFnOrDescription, assertionFn),
      commit: (): CommitResult<T, IndexKeys, Index> => this.$commit(chain),
      delete: () => this.$delete(chain),
      insert: (value: T | T[]) => this.$insert(value, chain),
      get: (value: unknown) => {
        const $chain = this.$get(value, chain);
        return $chain;
      },
      find: (value?: unknown) => this.$find(value, chain),
      limit: (amount: number) => this.$limit(amount, chain),
      offset: (amount: number) => this.$offset(amount, chain),
      orderBy: (order: Partial<Record<keyof T, "asc" | "desc">>) =>
        this.$orderBy(order, chain),
      replace: (value: T | ((item: T) => T)) => this.$replace(value, chain),
      select: <K extends keyof T>(properties: K[]) => {
        const $chain = chain.cloneForProperties(properties);
        return this.chain<Subset<DataResponse, T, K>, K>($chain);
      },
      set: (value: Partial<T> | ((item: T) => Partial<T>)) =>
        this.$set(value, chain),
    };
  }

  private $assert<Properties extends keyof T = keyof T>(
    assertion: AssertionFunction<T, IndexKeys, Properties, Index>,
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    if (!assertion(chain)) {
      throw new AssertionError();
    }

    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  private assert<Properties extends keyof T = keyof T>(
    chain: Chain<T, IndexKeys, Properties, Index>,
    assertionFnOrDescription:
      | AssertionFunction<T, IndexKeys, Properties, Index>
      | string,
    assertionFn?: AssertionFunction<T, IndexKeys, Properties, Index>
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
    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  private search<Properties extends keyof T = keyof T>(
    value:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown,
    { mode }: { mode: "find" | "get" },
    chain: Chain<T, IndexKeys, Properties, Index>
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

  private $get<Properties extends keyof T = keyof T>(
    value:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown,
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    const items = this.search(value, { mode: "get" }, chain);
    chain.update(items, { operation: "get", args: [value] });

    return this.chain<Pick<T, Properties>, Properties>(chain);
  }

  get(
    value?:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown
  ) {
    const chain = new Chain(this.hashTable);
    return this.$get(value, chain);
  }

  private $find<Properties extends keyof T = keyof T>(
    value:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown,
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    const items = this.search(value, { mode: "find" }, chain);
    chain.update(items, { operation: "find", args: [value] });

    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  // @todo find predicate has value unknown
  find(
    value?:
      | FindPredicate<T, HashTableItem<Index, T>>
      | AdvancedCondition
      | Index
      | unknown
  ) {
    const chain = new Chain(this.hashTable);
    return this.$find(value, chain);
  }

  private $select<DataResponse = T[], Properties extends keyof T = keyof T>(
    properties: Properties[],
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    const $chain = chain.cloneForProperties(properties);

    return this.chain<DataResponse, Properties>($chain);
  }

  select<K extends keyof T>(properties: K[]) {
    return this.$select(properties, new Chain(this.hashTable));
  }

  private $set<Properties extends keyof T = keyof T>(
    value: Partial<T> | ((item: T) => T | Partial<T>),
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    chain.set(value);

    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  set(value: Partial<T> | ((item: T) => T | Partial<T>)) {
    const chain = new Chain(this.hashTable);
    return this.$set(value, chain);
  }

  private $replace<Properties extends keyof T = keyof T>(
    value: T | ((item: T) => T),
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    chain.replace(value);

    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  replace(value: T | ((item: T) => T)) {
    const chain = new Chain(this.hashTable);
    return this.$replace(value, chain);
  }

  private $delete<Properties extends keyof T = keyof T>(
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    chain.delete();
    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  delete() {
    const chain = new Chain(this.hashTable);
    return this.$delete(chain);
  }

  private $insert<Properties extends keyof T = keyof T>(
    items: T | T[],
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    chain.insert(items);

    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  insert(items: T | T[]) {
    const chain = new Chain(this.hashTable);
    return this.$insert(items, chain);
  }

  private $limit<Properties extends keyof T = keyof T>(
    amount: number,
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    chain.update(chain.nodes.slice(0, amount), {
      operation: "limit",
      args: [amount],
    });
    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  limit(amount: number) {
    const chain = new Chain(this.hashTable);
    return this.$limit(amount, chain);
  }

  private $offset<Properties extends keyof T = keyof T>(
    amount: number,
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    chain.update(chain.nodes.slice(amount), {
      operation: "offset",
      args: [amount],
    });
    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  offset(amount: number) {
    const chain = new Chain(this.hashTable);
    return this.$offset(amount, chain);
  }

  private $orderBy<Properties extends keyof T = keyof T>(
    order: Partial<Record<keyof T, "asc" | "desc">>,
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    chain.orderBy(order);
    return this.chain<Pick<T, Properties>[], Properties>(chain);
  }

  orderBy(order: Partial<Record<keyof T, "asc" | "desc">>) {
    const chain = new Chain(this.hashTable);
    return this.$orderBy(order, chain);
  }

  unobserve(observerId: number) {
    const result = ["insert", "delete", "update", "*"].find((event) => {
      const $event = event as ObserverEvent;
      const index = this.observers[$event].findIndex(
        ({ id }) => id === observerId
      );
      if (index >= 0) {
        this.observers[$event].splice(index, 1);
        return true;
      }
    });

    if (!result) {
      throw new ObserverError("Unable to find observer to delete");
    }
  }

  observe(operation: "insert", callback: InsertObserver<T>): number;
  observe(operation: "update", callback: UpdateObserver<T>): number;
  observe(operation: "delete", callback: DeleteObserver<T>): number;
  observe(callback: GenericObserver<T>): number;
  observe(
    operationOrCallback: "insert" | "update" | "delete" | GenericObserver<T>,
    callback?: InsertObserver<T> | DeleteObserver<T> | UpdateObserver<T>
  ): number {
    if (typeof operationOrCallback === "string" && isCallable(callback)) {
      if (operationOrCallback === "insert") {
        this.observers.insert.push({
          id: ++this.observer,
          callback: callback as InsertObserver<T>,
        });
      } else if (operationOrCallback === "update") {
        this.observers.update.push({
          id: ++this.observer,
          callback: callback as UpdateObserver<T>,
        });
      } else if (operationOrCallback === "delete") {
        this.observers.delete.push({
          id: ++this.observer,
          callback: callback as DeleteObserver<T>,
        });
      } else {
        throw new ObserverError("Invalid operation");
      }

      return this.observer;
    }

    if (isCallable<GenericObserver<T>>(operationOrCallback)) {
      this.observers["*"].push({
        id: ++this.observer,
        callback: operationOrCallback,
      });

      return this.observer;
    }

    throw new ObserverError("Unknown operation");
  }

  private raiseEvents(events: MutationEvent<T>[]) {
    events.forEach((event) => {
      const { data, event: type } = event;
      this.observers["*"].forEach(({ callback }) => callback(event));

      if (type === "insert") {
        this.observers.insert.forEach(({ callback }) => callback(data));
      } else if (type === "delete") {
        this.observers.delete.forEach(({ callback }) => callback(data));
      } else if (type === "updated") {
        this.observers.update.forEach(({ callback }) =>
          callback(data.new, { old: data.old, new: data.new })
        );
      }
    });
  }

  private $commit<Properties extends keyof T = keyof T>(
    chain: Chain<T, IndexKeys, Properties, Index>
  ) {
    const result = chain.commit();

    this.raiseEvents(result.events);

    return result;
  }
}
