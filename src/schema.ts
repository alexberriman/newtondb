import type { JsonLimits, JsonObject, ReadonlyDeep } from "./json.js";
import type { PropertyPath } from "./path.js";

export type PrimaryKey = number | string;
export type PrimaryKeyField<T extends JsonObject> = {
  [Key in keyof T]-?: T[Key] extends PrimaryKey ? Key : never;
}[keyof T] &
  string;

export interface CollectionSchema<T extends JsonObject> {
  readonly generatePrimaryKey?: true | (() => string);
  readonly indexes?: readonly SecondaryIndex[];
  readonly primaryKey: PrimaryKeyField<T>;
  readonly validate?: (document: ReadonlyDeep<T>) => void;
  readonly limits?: Partial<JsonLimits>;
}

export type InsertDocument<T extends JsonObject> =
  T | Omit<T, PrimaryKeyField<T>>;

export interface SecondaryIndex {
  readonly name: string;
  readonly path: PropertyPath;
  readonly unique?: boolean;
}

export function collectionSchema<T extends JsonObject>(
  schema: CollectionSchema<T>,
): Readonly<CollectionSchema<T>> {
  return Object.freeze({ ...schema });
}

export type DatabaseSeed = Readonly<Record<string, readonly JsonObject[]>>;

export type WidenJson<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends null
        ? null
        : T extends readonly (infer Item)[]
          ? WidenJson<Item>[]
          : T extends JsonObject
            ? { [Key in keyof T]: WidenJson<T[Key]> }
            : never;

export type WidenSeed<Seed extends DatabaseSeed> = {
  [Name in keyof Seed]: Seed[Name] extends readonly (infer Document extends
    JsonObject)[]
    ? WidenJson<Document>[]
    : never;
};

export type DatabaseSchema<Seed extends DatabaseSeed> = {
  readonly [
    Name in keyof Seed
  ]: Seed[Name] extends readonly (infer Document extends JsonObject)[]
    ? CollectionSchema<Document>
    : never;
};

export type DocumentOf<
  Seed extends DatabaseSeed,
  Name extends keyof Seed,
> = Seed[Name] extends readonly (infer Document extends JsonObject)[]
  ? Document
  : never;
