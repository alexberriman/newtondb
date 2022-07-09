import { createHashTable, type HashTable } from "../data/hash-table";
import { asArray } from "../utils/types";
import {
  get as getByBasicCondition,
  query as queryByBasicCondition,
} from "../data/basic-query";
import { createCondition } from "./utils";

interface CollectionOptions<T> {
  primaryKey?: keyof T | (keyof T)[];
  validatePrimaryKey?: boolean;
  indexes?: (keyof T)[][];
}

export class Collection<T> {
  hashTable?: HashTable<T>;
  primaryKey: (keyof T)[];

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

  get(value: unknown) {
    const condition = createCondition(value, { primaryKey: this.primaryKey });

    // @todo find by primary key
    // @todo find by index
    // @todo find by function

    return getByBasicCondition(this.data, condition as Partial<T>);
  }

  find(value?: unknown, data?: T[]) {
    const filtered = queryByBasicCondition(
      data ?? this.data,
      createCondition(value, { primaryKey: this.primaryKey }) as Partial<T>
    );

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
