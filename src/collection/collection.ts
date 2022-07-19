import {
  asArray,
  isCallable,
  isScalar,
  isSingleArray,
  objectOfProperties,
  type Subset,
} from "../utils/types";
import {
  type AdvancedCondition,
  isCondition as isAdvancedCondition,
} from "../data/advanced-query/query";
import {
  get as getByBasicCondition,
  query as queryByBasicCondition,
} from "../data/basic-query";
import {
  get as getByAdvancedCondition,
  query as queryByAdvancedCondition,
} from "../data/advanced-query/db";
import { createCondition, isFindPredicate } from "./utils";
import { AssertionError } from "../errors/assertion-error";
import { HashTable, type HashTableItem } from "../data/hash-table/table";
import { Chain, type CommitResult } from "./chain";
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
import { cloneDeep } from "../utils/object";

export interface CollectionOptions<IndexKeys> {
  primaryKey?: IndexKeys | IndexKeys[];

  /**
   * By default, the data object that is initially passed in is mutated when
   * changes are committed. Setting `copy` to `true` creates a deep clone of
   * the data on instantiation so the original array of objects isn't mutated.
   *
   * @defaultValue `false`
   */
  copy?: boolean;
}

export type AssertionFunction<
  DataType,
  IndexKeys extends keyof DataType,
  Properties extends keyof DataType,
  Index
> = (arg0: Chain<DataType, IndexKeys, Properties, Index>) => boolean;

export type FindPredicate<DataShape, Y> = (
  value: DataShape,
  index: number,
  array: Y[]
) => value is DataShape;

export interface Chainable<
  Data,
  IndexKeys extends keyof Data,
  Index,
  DataResponse,
  Properties extends keyof Data
> {
  /* lorem ipsum 123 */
  readonly data: DataResponse;
  readonly nodes: HashTableItem<Index, Data>[];
  readonly count: number;
  readonly exists: boolean;
  readonly chain: Chain<
    Data,
    IndexKeys,
    Properties,
    Index,
    Pick<Data, Properties>
  >;
  assert: (
    assertionFnOrDescription:
      | AssertionFunction<Data, IndexKeys, Properties, Index>
      | string,
    assertionFn?: AssertionFunction<Data, IndexKeys, Properties, Index>
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
  commit: () => CommitResult<Data, IndexKeys, Index>;
  delete: () => Chainable<
    Data,
    IndexKeys,
    Index,
    Pick<Data, Properties>[],
    Properties
  >;
  insert: (
    value: Data | Data[]
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
  get: (
    value: unknown
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>, Properties>;
  find: (
    value?: unknown
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
  limit: (
    amount: number
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
  offset: (
    amount: number
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
  orderBy: (
    order: Partial<Record<keyof Data, "asc" | "desc">>
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
  replace: (
    value: Data | ((item: Data) => Data)
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
  select: <K extends keyof Data>(
    properties: K[]
  ) => Chainable<Data, IndexKeys, Index, Subset<DataResponse, Data, K>, K>;
  set: (
    value: Partial<Data> | ((item: Data) => Partial<Data>)
  ) => Chainable<Data, IndexKeys, Index, Pick<Data, Properties>[], Properties>;
}

/**
 * When thinking of data sources expressed in JSON, you will often have arrays/lists of data objects of a given type:
 *
 * ```json
 * [
 *   { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" },
 *   { "name": "Albert Einstein", "born": "1879-03-14T12:00:00.000Z" }
 * ]
 * ```
 *
 * Newton defines an array of `objects` as a `Collection`.
 *
 * One might also have an object data structure which contains multiple named collections:
 *
 * ```json
 * {
 *   "scientists": [
 *     { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" },
 *     { "name": "Albert Einstein", "born": "1879-03-14T12:00:00.000Z" }
 *   ],
 *   "universities": [
 *     { "name": "University of Zurich", "location": "Zurich, Switzerland" }
 *   ]
 * }
 * ```
 *
 * Newton defines such a data structure as a `Database` containing multiple `Collections`.
 *
 * @template DataShape
 * The shape of the data structure contained within your collection. Will be statically
 * inferred from correctly typed data, otherwise you can pass through a type:
 *
 * ```ts
 * interface Scientist {
 *   name: string;
 *   age?: number;
 *   alive: boolean;
 *   gender: "male" | "female";
 * }
 *
 * const data = await remoteApiCall() as unknown[];
 *
 * // either:
 * const collection = new Collection<Scientist>(data);
 * const collection = new Collection(data as unknown as Scientist[]);
 * ```
 *
 * @template IndexKeys - A union of keys from your `DataShape` that define the primary
 * key. Default to a union of all keys when no primary key is set. Will be inferred from
 * the `primaryKey` option set during instantiation.
 *
 * ```ts
 * const collection = new Collection(data, { primaryKey: ["name", "dob"] });
 * // IndexKeys will be "name" | "dob"
 * ```
 *
 * @category Data
 */
export class Collection<
  DataShape,
  IndexKeys extends keyof DataShape = keyof DataShape,
  Index = Pick<DataShape, IndexKeys>
> {
  /* @internal */
  hashTable: HashTable<DataShape, IndexKeys, keyof DataShape, Index, DataShape>;

  private primaryKey: IndexKeys[];

  /**
   * Observers lorem
   */
  private observers: Observers<DataShape> = {
    insert: [],
    update: [],
    delete: [],
    "*": [],
  };

  private observer = 0;

  constructor(
    data: DataShape[],
    private options: CollectionOptions<IndexKeys> = {}
  ) {
    const { copy, primaryKey } = options;

    this.primaryKey = primaryKey ? asArray(primaryKey) : [];
    this.hashTable = new HashTable(copy ? cloneDeep(data) : data, {
      keyBy: this.primaryKey,
    });
  }

  /**
   * Returns an array of data as it currently exists within your chain.
   *
   * @example
   * For example, referencing `.data` on the root collection will return an array of all data in your collection:
   *
   * ```ts
   * $.data;
   *
   * // => [ { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" }, ... ]
   * ```
   *
   * When you start chaining operations, `.data` will return an array of data as it currently exists within your chain:
   *
   * ```ts
   * $.find({ name: "Isaac Newton" }).data;
   *
   * // => [ { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" } ]
   * ```
   */
  get data(): DataShape[] {
    return this.hashTable.data;
  }

  get nodes() {
    return this.hashTable.nodes;
  }

  private chain<DataResponse, Properties extends keyof DataShape>(
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ): Chainable<DataShape, IndexKeys, Index, DataResponse, Properties> {
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
          | AssertionFunction<DataShape, IndexKeys, Properties, Index>
          | string,
        assertionFn?: AssertionFunction<DataShape, IndexKeys, Properties, Index>
      ) => this.assert(chain, assertionFnOrDescription, assertionFn),
      commit: (): CommitResult<DataShape, IndexKeys, Index> =>
        this.$commit(chain),
      delete: () => this.$delete(chain),
      insert: (value: DataShape | DataShape[]) => this.$insert(value, chain),
      get: (value: unknown) => {
        const $chain = this.$get(value, chain);
        return $chain;
      },
      find: (value?: unknown) => this.$find(value, chain),
      limit: (amount: number) => this.$limit(amount, chain),
      offset: (amount: number) => this.$offset(amount, chain),
      orderBy: (order: Partial<Record<keyof DataShape, "asc" | "desc">>) =>
        this.$orderBy(order, chain),
      replace: (value: DataShape | ((item: DataShape) => DataShape)) =>
        this.$replace(value, chain),
      select: <K extends keyof DataShape>(properties: K[]) => {
        const $chain = chain.cloneForProperties(properties);
        return this.chain<Subset<DataResponse, DataShape, K>, K>($chain);
      },
      set: (
        value: Partial<DataShape> | ((item: DataShape) => Partial<DataShape>)
      ) => this.$set(value, chain),
    };
  }

  /**
   * @throws AssertionError
   */
  private $assert<Properties extends keyof DataShape = keyof DataShape>(
    assertion: AssertionFunction<DataShape, IndexKeys, Properties, Index>,
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    if (!assertion(chain)) {
      throw new AssertionError();
    }

    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * Runs an `assertion` on your chain, and continues the chain execution if the assertion passes and raises an `AssertionError` when it fails.
   *
   * @remarks
   * Takes as input a function whose single argument is the chain instance and which returns a `boolean`:
   *
   * @example
   * ```ts
   * import { AssertionError } from "newtondb";
   *
   * try {
   *   $.get({ name: "isaac newton" })
   *     .assert(({ exists }) => exists)
   *     .set({ university: "unknown" })
   *     .commit();
   * } catch (e: unknown) {
   *   if (e instanceof AssertionError) {
   *     // record does not exist
   *   }
   * }
   * ```
   *
   * @example
   * You can optionally pass through a `string` as the first argument and a `function` as the second to describe your assertion:
   *
   * ```ts
   * import { AssertionError } from "newtondb";
   *
   * try {
   *   $.get({ name: "isaac newton" })
   *     .assert(
   *       "the record the user is attempting to update exists",
   *       ({ exists }) => exists
   *     )
   *     .set({ university: "unknown" })
   *     .commit();
   * } catch (e: unknown) {
   *   if (e instanceof AssertionError) {
   *     // record does not exist
   *   }
   * }
   * ```
   */
  private assert<Properties extends keyof DataShape = keyof DataShape>(
    chain: Chain<DataShape, IndexKeys, Properties, Index>,
    assertionFnOrDescription:
      | AssertionFunction<DataShape, IndexKeys, Properties, Index>
      | string,
    assertionFn?: AssertionFunction<DataShape, IndexKeys, Properties, Index>
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
    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  private search<Properties extends keyof DataShape = keyof DataShape>(
    value:
      | FindPredicate<DataShape, HashTableItem<Index, DataShape>>
      | AdvancedCondition
      | Index
      | unknown,
    { mode }: { mode: "find" | "get" },
    chain: Chain<DataShape, IndexKeys, Properties, Index>
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

    if (isFindPredicate<DataShape, HashTableItem<Index, DataShape>>(value)) {
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
        createCondition(value, {
          primaryKey: this.primaryKey,
        }) as Partial<DataShape>,
        preProcessor
      )
    );
  }

  private $get<Properties extends keyof DataShape = keyof DataShape>(
    value:
      | FindPredicate<DataShape, HashTableItem<Index, DataShape>>
      | AdvancedCondition
      | Index
      | unknown,
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    const items = this.search(value, { mode: "get" }, chain);
    chain.update(items, { operation: "get", args: [value] });

    return this.chain<Pick<DataShape, Properties>, Properties>(chain);
  }

  /**
   * Returns a single record. Most commonly used when querying your collection by a unique identifier.
   *
   * @example
   * For example:
   *
   * ```ts
   * $.get({ code: "isa" }).data;
   *
   * // => { "code": "isa", "name": "Isaac Newton", "university": "berlin" }
   * ```
   *
   * @example
   * When your collection has been instantiated with a primary key, and your primary key is a single property whose value is a scalar (e.g. a `string` or a `number`), you can call `.get` with that scalar value and Newton will infer the fact that you're querying against your primary key:
   *
   * ```ts
   * $.get("isa").data;
   *
   * // => { "code": "isa", "name": "Isaac Newton", "university": "berlin" }
   * ```
   *
   * @group Query
   */
  get(
    value?:
      | FindPredicate<DataShape, HashTableItem<Index, DataShape>>
      | AdvancedCondition
      | Index
      | unknown
  ) {
    const chain = new Chain(this.hashTable);
    return this.$get(value, chain);
  }

  private $find<Properties extends keyof DataShape = keyof DataShape>(
    value:
      | FindPredicate<DataShape, HashTableItem<Index, DataShape>>
      | AdvancedCondition
      | Index
      | unknown,
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    const items = this.search(value, { mode: "find" }, chain);
    chain.update(items, { operation: "find", args: [value] });

    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   *
   * Returns multiple records.
   *
   * @example
   * For example:
   *
   * ```ts
   * $.find({ university: "cambridge" }).data;
   *
   * // => [ { "code": "alb", "name": "Albert Einstein", "university": "cambridge" } ]
   * ```
   *
   * Will return an empty array when no results are found.
   *
   * @todo find predicate has value unknown
   * @group Query
   */
  find(
    value?:
      | FindPredicate<DataShape, HashTableItem<Index, DataShape>>
      | AdvancedCondition
      | Index
      | unknown
  ) {
    const chain = new Chain(this.hashTable);
    return this.$find(value, chain);
  }

  private $select<
    DataResponse = DataShape[],
    Properties extends keyof DataShape = keyof DataShape
  >(
    properties: Properties[],
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    const $chain = chain.cloneForProperties(properties);

    return this.chain<DataResponse, Properties>($chain);
  }

  /**
   * Returns a subset of an object's properties in the resulting data array.
   *
   * @example
   * By default, when a query returns records, the result includes all of those records' attributes. To only return a subset of an object's properties, call `.select` with an array of properties to return:
   *
   * ```ts
   * $.get({ name: "Isaac Newton" }).select(["university"]).data;
   *
   * // => { university: "Cambridge" }
   * ```
   *
   * @example
   * Given the result of one operation is fed into another, the order of `select` doesn't matter. The above will produce the same output as:
   *
   * ```ts
   * $.select(["university"]).get({ name: "Isaac Newton" }).data;
   *
   * // => { university: "Cambridge" }
   * ```
   *
   * @group Query
   */
  select<K extends keyof DataShape>(properties: K[]) {
    return this.$select(properties, new Chain(this.hashTable));
  }

  private $set<Properties extends keyof DataShape = keyof DataShape>(
    value:
      | Partial<DataShape>
      | ((item: DataShape) => DataShape | Partial<DataShape>),
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    chain.set(value);

    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * Updates a set of attributes on one or more records.
   *
   * @example
   *
   * ```ts
   * // update isaac newton's college to "n/a" and set isAlive to false
   * $.find({ name: "Isaac Newton" })
   *   .set({ college: "n/a", isAlive: false })
   *   .commit();
   * ```
   *
   * `set` can also take as input a function whose first argument is the current value of the record, and which must return a subset of the record to update:
   *
   * ```ts
   * // uppercase all universities using .set
   * $.set(({ university }) => ({
   *   university: university.toUpperCase(),
   * })).commit();
   * ```
   *
   * @group Mutate
   */
  set(
    value:
      | Partial<DataShape>
      | ((item: DataShape) => DataShape | Partial<DataShape>)
  ) {
    const chain = new Chain(this.hashTable);
    return this.$set(value, chain);
  }

  private $replace<Properties extends keyof DataShape = keyof DataShape>(
    value: DataShape | ((item: DataShape) => DataShape),
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    chain.replace(value);

    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * Replaces an entire document with a new document.
   *
   * @example
   *
   * ```ts
   * const newNewton = {
   *   name: "Isaac Newton",
   *   isAlive: false,
   *   diedOn: "1727-03-31T12:00:00.000Z",
   * };
   *
   * $.get("Isaac Newton").replace(newNewton).commit();
   * ```
   *
   * @example
   * `replace` can also take as input a function whose first argument is the current value of the record, and which must return a complete new record:
   *
   * ```ts
   * // uppercase all universities using .replace
   * $.replace((record) => ({
   *   ...record,
   *   university: university.toUpperCase(),
   * })).commit();
   * ```
   *
   * @group Mutate
   */
  replace(value: DataShape | ((item: DataShape) => DataShape)) {
    const chain = new Chain(this.hashTable);
    return this.$replace(value, chain);
  }

  private $delete<Properties extends keyof DataShape = keyof DataShape>(
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    chain.delete();
    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * Deletes one or more records from the collection.
   *
   * @remarks
   * `delete()` doesn't take any arguments. Rather, it deletes the records that currently exist within the chain at the time that it's called. For example:
   *
   * @example
   * ```ts
   * // delete all records from a collection
   * $.delete().commit();
   *
   * // delete all scientists from cambridge university
   * $.find({ university: "cambridge" }).delete().commit();
   *
   * // delete a single record
   * $.get("isaac newton").delete().commit();
   * ```
   *
   * @group Mutate
   */
  delete() {
    const chain = new Chain(this.hashTable);
    return this.$delete(chain);
  }

  private $insert<Properties extends keyof DataShape = keyof DataShape>(
    items: DataShape | DataShape[],
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    chain.insert(items);

    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * Inserts one or more records into the database.
   *
   * @example
   * Inserting a single record:
   *
   * ```ts
   * $.insert({
   *   name: "Nicolaus Copernicus",
   *   born: "1473-02-19T12:00:00.000Z",
   * }).commit();
   * ```
   *
   * @example
   * You can insert multiple records by passing through an array of objects to insert:
   *
   * ```ts
   * $.insert([
   *   { name: "Nicolaus Copernicus", born: "1473-02-19T12:00:00.000Z" },
   *   { name: "Edwin Hubble", born: "1989-11-10T12:00:00.000Z" },
   * ]).commit();
   * ```
   *
   * @group Mutate
   */
  insert(items: DataShape | DataShape[]) {
    const chain = new Chain(this.hashTable);
    return this.$insert(items, chain);
  }

  private $limit<Properties extends keyof DataShape = keyof DataShape>(
    amount: number,
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    chain.update(chain.nodes.slice(0, amount), {
      operation: "limit",
      args: [amount],
    });
    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * You can use `limit` to only return the first `n` amount of records within your chain:
   *
   * @example
   * ```ts
   * $.find({ university: "cambridge" }).limit(5).data;
   * ```
   *
   * Will return the first 5 records with `university` set to `"cambridge"`.
   *
   * @remarks
   * You can use `limit` with `offset` to implement an offset based pagination on your data.
   *
   * @group Query
   */
  limit(amount: number) {
    const chain = new Chain(this.hashTable);
    return this.$limit(amount, chain);
  }

  private $offset<Properties extends keyof DataShape = keyof DataShape>(
    amount: number,
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    chain.update(chain.nodes.slice(amount), {
      operation: "offset",
      args: [amount],
    });
    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * `offset` will skip the first `n` records from your query. For example, to skip the first 5 records:
   *
   * @example
   * ```ts
   * $.find({ university: "cambridge" }).offset(5).data;
   * ```
   *
   * @example
   * `offset` can be used with `limit` to implement an offset based pagination:
   *
   * ```ts
   * const pageSize = 10;
   * const currentPage = 3;
   *
   * $.find()
   *   .limit(pageSize)
   *   .offset((currentPage - 1) * pageSize).data;
   * ```
   *
   * @group Query
   */
  offset(amount: number) {
    const chain = new Chain(this.hashTable);
    return this.$offset(amount, chain);
  }

  private $orderBy<Properties extends keyof DataShape = keyof DataShape>(
    order: Partial<Record<keyof DataShape, "asc" | "desc">>,
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    chain.orderBy(order);
    return this.chain<Pick<DataShape, Properties>[], Properties>(chain);
  }

  /**
   * `orderBy` can be used to sort records by one or more properties. It takes as input a single object whose properties are a key of your collection's properties, and whose value is either `asc` (for ascending) or `desc` (for descending).
   *
   * @example
   * Using the below dataset:
   *
   * ```ts
   * const students = [
   *   { name: "roger galilei", university: "mit" },
   *   { name: "kip tesla", university: "harvard" },
   *   { name: "rosalind faraday", university: "harvard" },
   *   { name: "thomas franklin", university: "mit" },
   *   { name: "albert currie", university: "harvard" },
   * ];
   * ```
   *
   * To sort by university in descending order and name in ascending order:
   *
   * ```ts
   * $.orderBy({ university: "desc", name: "asc" }).data;
   * ```
   *
   * This will produce the following:
   *
   * ```json
   * [
   *   { "name": "roger galilei", "university": "mit" },
   *   { "name": "thomas franklin", "university": "mit" },
   *   { "name": "albert currie", "university": "harvard" },
   *   { "name": "kip tesla", "university": "harvard" },
   *   { "name": "rosalind faraday", "university": "harvard" }
   * ]
   * ```
   * @example
   * Given the order by which you sort is important, `orderBy()` will adhere to the order of the properties in the object passed through.
   *
   * For example, in the above example, `{ university: "desc", name: "asc" }` was passed through. `orderBy` would first sort by `university` in `descending` order, and then by `name` in ascending order.
   *
   * If you were to instead pass through `{ name: "asc", university: "desc" }`, `orderBy` would first sort by name in `ascending` order and then by `university` in `descending` order. This would produce a different result:
   *
   * ```json
   * [
   *   { "name": "albert currie", "university": "harvard" },
   *   { "name": "kip tesla", "university": "harvard" },
   *   { "name": "roger galilei", "university": "mit" },
   *   { "name": "rosalind faraday", "university": "harvard" },
   *   { "name": "thomas franklin", "university": "mit" }
   * ]
   * ```
   *
   * @group Query
   */
  orderBy(order: Partial<Record<keyof DataShape, "asc" | "desc">>) {
    const chain = new Chain(this.hashTable);
    return this.$orderBy(order, chain);
  }

  /**
   * Cancels an observer set with the `.observe()` method. Takes as input a numeric ID (which should correspond to the output of the original `.observe` call).
   *
   * @throws ObserverError
   * @group Observer
   */
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

  /**
   * Sets up a callback that are triggered on committed data mutations.
   *
   * @remarks
   * When mutations to the data source are committed, one or more of the following events will be raised:
   *
   * - `insert`: raised when a record is inserted into the collection
   * - `delete`: raised when a record is deleted from the collection
   * - `updated`: raised when a record is updated
   *
   * You can pass callbacks to the `observe` method that will be triggered when these events occur.
   *
   * @example
   * On insert:
   *
   * ```ts
   * const onInsert = $.observe("insert", (record) => {
   *   //
   * });
   * ```
   *
   * @example
   * On delete:
   *
   * ```ts
   * const onDelete = $.observe("delete", (record) => {
   *   //
   * });
   * ```
   *
   * @example
   * On update:
   *
   * ```ts
   * const onUpdate = $.observe("updated", (record, historical) => {
   *   // historical.old = item before update
   *   // historical.new = item after update
   * });
   * ```
   *
   * @example
   * You can also pass through a wildcard observer which will be triggered on every event:
   *
   * ```ts
   * const wildcardObserver = $.observe((event, data) => {
   *   // event: "insert" | "delete" | "updated"
   *   // data: event data
   * });
   * ```
   *
   * Calls to `.observe()` will return an numeric id of the observer. This id should be passed to `unobserve()` to cancel the observer.
   *
   * @throws ObserverError
   * @group Observer
   */
  observe(operation: "insert", callback: InsertObserver<DataShape>): number;
  observe(operation: "update", callback: UpdateObserver<DataShape>): number;
  observe(operation: "delete", callback: DeleteObserver<DataShape>): number;
  observe(callback: GenericObserver<DataShape>): number;
  observe(
    operationOrCallback:
      | "insert"
      | "update"
      | "delete"
      | GenericObserver<DataShape>,
    callback?:
      | InsertObserver<DataShape>
      | DeleteObserver<DataShape>
      | UpdateObserver<DataShape>
  ): number {
    if (typeof operationOrCallback === "string" && isCallable(callback)) {
      if (operationOrCallback === "insert") {
        this.observers.insert.push({
          id: ++this.observer,
          callback: callback as InsertObserver<DataShape>,
        });
      } else if (operationOrCallback === "update") {
        this.observers.update.push({
          id: ++this.observer,
          callback: callback as UpdateObserver<DataShape>,
        });
      } else if (operationOrCallback === "delete") {
        this.observers.delete.push({
          id: ++this.observer,
          callback: callback as DeleteObserver<DataShape>,
        });
      } else {
        throw new ObserverError("Invalid operation");
      }

      return this.observer;
    }

    if (isCallable<GenericObserver<DataShape>>(operationOrCallback)) {
      this.observers["*"].push({
        id: ++this.observer,
        callback: operationOrCallback,
      });

      return this.observer;
    }

    throw new ObserverError("Unknown operation");
  }

  private raiseEvents(events: MutationEvent<DataShape>[]) {
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

  private $commit<Properties extends keyof DataShape = keyof DataShape>(
    chain: Chain<DataShape, IndexKeys, Properties, Index>
  ) {
    const result = chain.commit();

    this.raiseEvents(result.events);

    return result;
  }
}
