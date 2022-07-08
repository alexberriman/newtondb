import { BaseDatabase } from "./base-database";
import { type AnyCollectionDataType } from "../collection/collection";

export type AnyDatabaseType = Record<string, AnyCollectionDataType>;

export class DictionaryDatabase<DataShape> extends BaseDatabase {
  constructor(public data: DataShape) {
    super();
  }
}
