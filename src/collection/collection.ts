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
import { HashTable } from "../data/hash-table";

interface CollectionOptions<T, IndexKeys> {
  primaryKey?: IndexKeys | IndexKeys[];
  validatePrimaryKey?: boolean;
  indexes?: (keyof T)[][];
}

interface ChainData<T> {
  count: number;
  data: T | T[];
  exists: boolean;
}

type AssertionFunction<C> = (arg0: ChainData<C>) => boolean;

export type FindPredicate<T> = (
  value: T,
  index: number,
  array: T[]
) => value is T;

export class Collection<
  T,
  IndexKeys extends keyof T,
  Index = Pick<T, IndexKeys>
> {
  primaryKey: IndexKeys[];
  hashTable: HashTable<T, keyof T>;

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

  chain<C = T[]>(data: C) {
    const array = asArray(data) as unknown as T[];

    const dataValues = {
      count: array.length,
      data,
      exists: array.length > 0,
    };

    return {
      ...dataValues,
      assert: (assertion: AssertionFunction<C>) =>
        this.assert(assertion, dataValues),
      get: (value: unknown) => this.get(value, array),
      find: (value?: unknown) => this.find(value, array),
      offset: (amount: number) => this.offset(amount, array),
      limit: (amount: number) => this.limit(amount, array),
    };
  }

  private assert<C>(assertion: AssertionFunction<C>, chainData: ChainData<C>) {
    if (!assertion(chainData)) {
      throw new AssertionError();
    }

    return this.chain(chainData.data);
  }

  private $find(
    value: FindPredicate<T> | AdvancedCondition | Index | unknown,
    data: T[] = this.data,
    { mode }: { mode: "find" | "get" }
  ) {
    const items = data ?? this.data;

    if (isFindPredicate<T>(value)) {
      return mode === "get" ? asArray(items.find(value)) : items.filter(value);
    }

    if (isAdvancedCondition(value)) {
      return mode === "get"
        ? asArray(getByAdvancedCondition(items, value))
        : queryByAdvancedCondition(items, value);
    }

    if (
      objectOfProperties<Pick<T, keyof T>>(value, this.primaryKey as string[])
    ) {
      // primary key was passed through - can pull directly from hash table
      // rather than iterate through the list
      return this.hashTable.get(value) as T[];
    }

    if (isScalar(value) && isSingleArray(this.primaryKey)) {
      // scalar value was passed through and collection has a single primary
      // key - can hit the hash table
      return this.hashTable.get({
        [this.primaryKey[0]]: value,
      } as unknown as Pick<T, keyof T>) as T[];
    }

    const basicFn =
      mode === "get" ? getByBasicCondition : queryByBasicCondition;

    return asArray(
      basicFn(
        items,
        createCondition(value, { primaryKey: this.primaryKey }) as Partial<T>
      )
    );
  }

  get(
    value: FindPredicate<T> | AdvancedCondition | Index | unknown,
    data: T[] = this.data
  ) {
    const items = this.$find(value, data, { mode: "get" });
    return this.chain(items[0]);
  }

  find(
    value?: FindPredicate<T> | AdvancedCondition | Index | unknown,
    data?: T[]
  ) {
    const items = this.$find(value, data, { mode: "find" });
    return this.chain(items);
  }

  insert(record: T) {
    // this.data = [...this.data, record];
    // @todo add to hash table
  }

  limit(amount: number, data: T[] = this.data) {
    return this.chain(data.slice(0, amount));
  }

  offset(amount: number, data: T[] = this.data) {
    return this.chain(data.slice(amount));
  }

  sort() {
    // @todo
  }

  expand() {
    // @todo
  }

  delete() {
    // @todo
  }
}
