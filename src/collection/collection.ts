import { asArray } from "../utils/types";
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

interface CollectionOptions<T> {
  primaryKey?: keyof T | (keyof T)[];
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

export class Collection<T> {
  primaryKey: (keyof T)[];

  constructor(public data: T[], private options: CollectionOptions<T> = {}) {
    const { primaryKey } = options;

    this.primaryKey = primaryKey ? asArray(primaryKey) : [];
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

  get(
    value: FindPredicate<T> | AdvancedCondition | unknown,
    data: T[] = this.data
  ) {
    // @todo find by primary key
    // @todo find by index
    if (isFindPredicate<T>(value)) {
      return this.chain(data.find(value));
    }

    if (isAdvancedCondition(value)) {
      return this.chain(getByAdvancedCondition(data, value));
    }

    return this.chain(
      getByBasicCondition(
        data,
        createCondition(value, { primaryKey: this.primaryKey }) as Partial<T>
      )
    );
  }

  find(value?: FindPredicate<T> | unknown, data?: T[]) {
    // @todo find by primary key
    // @todo find by index
    const items = data ?? this.data;

    if (isFindPredicate<T>(value)) {
      return this.chain(items.filter(value));
    }

    if (isAdvancedCondition(value)) {
      return this.chain(queryByAdvancedCondition(items, value));
    }

    return this.chain(
      queryByBasicCondition(
        items,
        createCondition(value, { primaryKey: this.primaryKey }) as Partial<T>
      )
    );
  }

  insert(record: T) {
    this.data = [...this.data, record];
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
