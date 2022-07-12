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
import { Chain } from "./chain";

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

type AssertionFunction<C> = (arg0: Chain<C>) => boolean;

export type FindPredicate<T> = (
  value: T,
  index: number,
  array: T[]
) => value is T;

type Mutation = any;

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

  private chain<C = T[]>(data: C, chain: Chain<T>) {
    const items = asArray(data) as unknown as T[];
    chain.data = items;

    const dataValues = {
      count: items.length,
      data,
      exists: items.length > 0,
    };

    return {
      ...dataValues,
      assert: (assertion: AssertionFunction<T>) =>
        this.assert(assertion, data, chain),
      commit: () => this.commit(chain),
      delete: () => {
        const result = this.delete(chain);
        return result;
      },
      get: (value: unknown) => this.get(value, chain),
      find: (value?: unknown) => this.find(value, chain),
      limit: (amount: number) => this.limit(amount, chain),
      offset: (amount: number) => this.offset(amount, chain),
      set: () => {
        const result = this.set(chain);
        return result;
      },
    };
  }

  private assert<C>(
    assertion: AssertionFunction<T>,
    data: C,
    chain: Chain<T> = new Chain(this.data)
  ) {
    if (!assertion(chain)) {
      throw new AssertionError();
    }

    return this.chain(data, chain);
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
    chain: Chain<T> = new Chain(this.data)
  ) {
    const items = this.$find(value, chain.data, { mode: "get" });

    return this.chain(items[0], chain);
  }

  find(
    value?: FindPredicate<T> | AdvancedCondition | Index | unknown,
    chain: Chain<T> = new Chain(this.data)
  ) {
    const items = this.$find(value, chain.data, { mode: "find" });
    return this.chain(items, chain);
  }

  set(chain: Chain<T> = new Chain(this.data)) {
    const mutation = [{ fn: "set" }, { example: "alamat" }];
    chain.addMutation(mutation);

    return this.chain(chain.data, chain);
  }

  delete(chain: Chain<T> = new Chain(this.data)) {
    const mutation = [{ lorem: "ipsum" }, { dolor: "alamat" }];
    chain.addMutation(mutation);

    return this.chain(chain.data, chain);
  }

  private commit(chain: Chain<T> = new Chain(this.data)) {
    // console.log("commit", "mutations", chain.mutations);
    // do nothing
  }

  insert(record: T) {
    // this.data = [...this.data, record];
    // @todo add to hash table
  }

  limit(amount: number, chain: Chain<T> = new Chain(this.data)) {
    return this.chain(chain.data.slice(0, amount), chain);
  }

  offset(amount: number, chain: Chain<T> = new Chain(this.data)) {
    return this.chain(chain.data.slice(amount), chain);
  }

  sort() {
    // @todo
  }

  expand() {
    // @todo
  }
}
