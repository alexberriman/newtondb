interface CollectionOptions {
  primaryKey?: string | string[];
  indexes?: string[][];
  validateId?: boolean;
}

export class Collection<T> {
  constructor(public data: T[], private options: CollectionOptions = {}) {}

  find(): T[] {
    return [];
  }

  insert(record: T) {
    this.data = [...this.data, record];
  }
}
