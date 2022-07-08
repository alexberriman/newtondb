import { BaseDatabase } from "./base-database";

export class CollectionDatabase<DataType> extends BaseDatabase {
  constructor(public data: DataType[]) {
    super();
  }
}
