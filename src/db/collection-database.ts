import { Collection } from "../collection/collection";
import { BaseDatabase } from "./base-database";

export class CollectionDatabase<
  DataType,
  IndexKeys extends keyof DataType
> extends BaseDatabase {
  $: Collection<DataType, IndexKeys>;

  constructor(public data: DataType[]) {
    super();

    this.$ = new Collection(data);
  }
}
