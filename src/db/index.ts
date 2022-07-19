import type { Database } from "./init";

import type {
  AllowedData,
  DatabaseCollectionOptions,
  DatabaseObserverCallback,
  DatabaseOptions,
  Db,
  DbObserverCallback,
  DbCollectionOptions,
  DbObserverEvent,
  Instance,
  ValueOf,
} from "./types";

import { isCollection, isDatabase } from "./types";

export type {
  Database,
  AllowedData,
  DatabaseCollectionOptions,
  DatabaseObserverCallback,
  DatabaseOptions,
  Db,
  DbObserverCallback,
  DbCollectionOptions,
  DbObserverEvent,
  Instance,
  ValueOf,
};

export { isCollection, isDatabase };
