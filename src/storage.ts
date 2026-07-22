import type { JsonObject } from "./json.js";
import type { DatabaseSchema, DatabaseSeed } from "./schema.js";

export const snapshotFormat = "newtondb" as const;
export const snapshotFormatVersion = 1 as const;

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
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const candidate = value as Partial<Record<keyof SnapshotEnvelope, unknown>>;
  return (
    candidate.format === snapshotFormat &&
    candidate.formatVersion === snapshotFormatVersion &&
    typeof candidate.databaseId === "string" &&
    candidate.databaseId.length > 0 &&
    Number.isSafeInteger(candidate.generation) &&
    (candidate.generation as number) >= 0 &&
    Number.isSafeInteger(candidate.revision) &&
    (candidate.revision as number) >= 0 &&
    candidate.catalog !== null &&
    typeof candidate.catalog === "object" &&
    candidate.collections !== null &&
    typeof candidate.collections === "object"
  );
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
