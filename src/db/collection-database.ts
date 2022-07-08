import { Collection } from "../collection/collection";
import { BaseDatabase } from "./base-database";

export class CollectionDatabase<DataType> extends BaseDatabase {
  $: Collection<DataType>;

  constructor(public data: DataType[]) {
    super();

    this.$ = new Collection(data);
  }
}
