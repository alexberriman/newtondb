import { FindError } from "../errors/find-error";
import { createHashTable, type HashTable } from "../data/hash-table";
import { asArray, isDefined, isObject, isScalar } from "../utils/types";
import {
  get as getByBasicCondition,
  query as queryByBasicCondition,
} from "../data/basic-query";

interface CollectionOptions<T> {
  primaryKey?: keyof T | (keyof T)[];
  validatePrimaryKey?: boolean;
  indexes?: (keyof T)[][];
}

export class Collection<T> {
  hashTable?: HashTable<T>;
  primaryKey!: (keyof T)[];

  constructor(public data: T[], private options: CollectionOptions<T> = {}) {
    const { primaryKey } = options;

    this.primaryKey = primaryKey ? asArray(primaryKey) : [];
    if (primaryKey) {
      this.hashTable = createHashTable(data, {
        index: this.primaryKey,
      });
    }
  }

  chain(data: T[]) {
    return {
      data,
      find: (value?: unknown) => this.find(value, data),
      offset: (amount: number) => this.offset(amount, data),
      limit: (amount: number) => this.limit(amount, data),
    };
  }

  private condition(condition: unknown): Record<string, unknown> {
    if (isObject(condition)) {
      return condition;
    }

    if (isScalar(condition) && this.primaryKey.length === 1) {
      return { [this.primaryKey[0]]: condition };
    }

    throw new FindError(
      "Attempted to find by a scalar without configuring a primaryKey"
    );
  }

  get(value: unknown) {
    const condition = this.condition(value);

    // @todo find by primary key
    // @todo find by index
    // @todo find by function

    return getByBasicCondition(this.data, condition as Partial<T>);
  }

  find(value?: unknown, data?: T[]) {
    const condition = isDefined(value) ? this.condition(value) : {};
    const source = data ?? this.data;
    const filtered = queryByBasicCondition(source, condition as Partial<T>);

    // @todo find by primary key
    // @todo find by index
    // @todo find by function

    return this.chain(filtered);
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
