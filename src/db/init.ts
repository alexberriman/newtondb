import { CollectionDatabase } from "./collection-database";
import { DictionaryDatabase } from "./dictionary-database";

function init<T>(data: T[]): CollectionDatabase<T, keyof T>;
function init<T>(data: T): DictionaryDatabase<T>;
function init<T>(data: T[] | T) {
  if (Array.isArray(data)) {
    return new CollectionDatabase(data);
  }

  return new DictionaryDatabase(data);
}

export default init;
