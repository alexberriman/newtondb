import { Collection } from "../collection/collection";
import { BaseDatabase } from "./base-database";

type Collections<DataShape> = {
  [Property in keyof DataShape]: Collection<DataShape[Property]>;
};

function initCollections<T>(data: T) {
  return Object.entries(data).reduce(
    (collections, [key, value]) => ({
      ...collections,
      [key]: new Collection(value),
    }),
    {}
  ) as Collections<T>;
}

export class DictionaryDatabase<DataShape> extends BaseDatabase {
  $: Collections<DataShape>;

  constructor(public data: DataShape) {
    super();

    this.$ = initCollections(data);
  }
}
