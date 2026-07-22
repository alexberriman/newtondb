import type { JsonObject } from "./json.js";
import type { DatabaseSchema, DatabaseSeed } from "./schema.js";

export const snapshotFormat = "newtondb" as const;
export const snapshotFormatVersion = 1 as const;
export const snapshotMaximumReadableVersion = snapshotFormatVersion;
export const snapshotMinimumReadableVersion = snapshotFormatVersion;

export interface CatalogCollection {
  readonly generatedPrimaryKey: boolean;
  readonly indexes: readonly Readonly<{
    readonly name: string;
    readonly path: readonly (number | string)[];
    readonly unique: boolean;
  }>[];
  readonly primaryKey: string;
}

export type DatabaseCatalog = Readonly<Record<string, CatalogCollection>>;

export interface SnapshotEnvelope<Seed extends DatabaseSeed = DatabaseSeed> {
  readonly catalog: DatabaseCatalog;
  readonly collections: Seed;
  readonly databaseId: string;
  readonly format: typeof snapshotFormat;
  readonly formatVersion: typeof snapshotFormatVersion;
  readonly generation: number;
  readonly revision: number;
}

export interface StoreAcknowledgement {
  readonly databaseId: string;
  readonly generation: number;
  readonly revision: number;
}

export interface StorageAdapter<Seed extends DatabaseSeed> {
  close(): Promise<void>;
  load(
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<SnapshotEnvelope<Seed> | null>;
  store(
    snapshot: SnapshotEnvelope<Seed>,
    options: Readonly<{ expectedGeneration: number; signal?: AbortSignal }>,
  ): Promise<StoreAcknowledgement>;
}

export function createCatalog<Seed extends DatabaseSeed>(
  schema: DatabaseSchema<Seed>,
): DatabaseCatalog {
  const output: Record<string, CatalogCollection> = Object.create(
    null,
  ) as Record<string, CatalogCollection>;
  for (const name of Object.keys(schema).sort()) {
    const collection = schema[name];
    if (collection === undefined) continue;
    Object.defineProperty(output, name, {
      enumerable: true,
      value: Object.freeze({
        generatedPrimaryKey: collection.generatePrimaryKey !== undefined,
        indexes: Object.freeze(
          [...(collection.indexes ?? [])]
            .map((index) =>
              Object.freeze({
                name: index.name,
                path: Object.freeze([...index.path]),
                unique: index.unique ?? false,
              }),
            )
            .sort((left, right) => left.name.localeCompare(right.name)),
        ),
        primaryKey: collection.primaryKey,
      }),
    });
  }
  return Object.freeze(output);
}

export function catalogsEqual(
  left: DatabaseCatalog,
  right: DatabaseCatalog,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isSnapshotEnvelope(value: unknown): value is SnapshotEnvelope {
  const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
    candidate !== null &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    (Object.getPrototypeOf(candidate) === Object.prototype ||
      Object.getPrototypeOf(candidate) === null);
  try {
    if (!isRecord(value)) return false;
    const candidate = value;
    if (
      candidate.format !== snapshotFormat ||
      candidate.formatVersion !== snapshotFormatVersion ||
      typeof candidate.databaseId !== "string" ||
      candidate.databaseId.length === 0 ||
      candidate.databaseId.length > 256 ||
      !Number.isSafeInteger(candidate.generation) ||
      (candidate.generation as number) < 0 ||
      !Number.isSafeInteger(candidate.revision) ||
      (candidate.revision as number) < 0 ||
      !isRecord(candidate.catalog) ||
      !isRecord(candidate.collections)
    ) {
      return false;
    }
    const catalogNames = Object.keys(candidate.catalog).sort();
    if (
      JSON.stringify(catalogNames) !==
      JSON.stringify(Object.keys(candidate.collections).sort())
    ) {
      return false;
    }
    for (const name of catalogNames) {
      const catalog = candidate.catalog[name];
      const collection = candidate.collections[name];
      if (
        name.length === 0 ||
        !isRecord(catalog) ||
        typeof catalog.generatedPrimaryKey !== "boolean" ||
        typeof catalog.primaryKey !== "string" ||
        catalog.primaryKey.length === 0 ||
        !Array.isArray(catalog.indexes) ||
        !Array.isArray(collection)
      ) {
        return false;
      }
      for (const index of catalog.indexes) {
        if (
          !isRecord(index) ||
          typeof index.name !== "string" ||
          index.name.length === 0 ||
          typeof index.unique !== "boolean" ||
          !Array.isArray(index.path) ||
          index.path.length === 0 ||
          typeof index.path[0] !== "string" ||
          index.path.some(
            (token, position) =>
              typeof token !== "string" &&
              !(
                position > 0 &&
                typeof token === "number" &&
                Number.isSafeInteger(token) &&
                token >= 0
              ),
          )
        ) {
          return false;
        }
      }
      if (collection.some((document) => !isRecord(document))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function cloneSnapshotCollections(
  collections: ReadonlyMap<
    string,
    Readonly<{
      readonly order: readonly string[];
      readonly records: ReadonlyMap<string, JsonObject>;
    }>
  >,
): DatabaseSeed {
  const output: Record<string, readonly JsonObject[]> = Object.create(
    null,
  ) as Record<string, readonly JsonObject[]>;
  for (const [name, collection] of collections) {
    Object.defineProperty(output, name, {
      enumerable: true,
      value: Object.freeze(
        collection.order.map((key) => {
          const document = collection.records.get(key);
          if (document === undefined)
            throw new Error("Record order invariant violated");
          return document;
        }),
      ),
    });
  }
  return Object.freeze(output);
}
