import { FindError } from "../errors/find-error";
import { createHashTable, type HashTable } from "../index/hash-table";
import { asArray, isObject, isScalar } from "../utils/types";

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

  get canLookup() {
    const { primaryKey } = this.options;

    return !!(primaryKey && this.hashTable);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const condition = this.condition(value);

    // @todo find by primary key
    // @todo find by index

    return this.data[0];
  }

  find(): T[] {
    return [];
  }

  insert(record: T) {
    this.data = [...this.data, record];
  }
}
