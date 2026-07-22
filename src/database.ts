import {
  ClosedError,
  ConflictError,
  CorruptStorageError,
  DuplicateKeyError,
  DuplicateUniqueIndexError,
  ImmutablePrimaryKeyError,
  InvariantViolationError,
  InvalidArgumentError,
  NotFoundError,
  PersistenceError,
  StorageError,
  SchemaValidationError,
  TransactionCallbackError,
  TransactionStateError,
} from "./errors.js";
import type { Change, ChangeBatch, ChangeListener } from "./events.js";
import {
  cloneAndFreezeJsonObject,
  defaultJsonLimits,
  type JsonLimits,
  type JsonObject,
  type JsonPrimitive,
  type JsonValue,
  type ReadonlyDeep,
} from "./json.js";
import { documentKey, encodeIndexValue, encodeKey } from "./key.js";
import { readPath, samePath, validatePath, type PropertyPath } from "./path.js";
import {
  assertNonNegativeInteger,
  compileWhere,
  type LocalPredicate,
  type ComparisonCondition,
  type Where,
} from "./query.js";
import {
  type CollectionSchema,
  type DatabaseSchema,
  type DatabaseSeed,
  type DocumentOf,
  type InsertDocument,
  type PrimaryKey,
  type WidenSeed,
} from "./schema.js";
import {
  catalogsEqual,
  cloneSnapshotCollections,
  createCatalog,
  type SnapshotEnvelope,
  type StorageAdapter,
} from "./storage.js";

interface StoredCollection {
  readonly indexes: ReadonlyMap<string, SecondaryIndexState>;
  readonly order: readonly string[];
  readonly records: ReadonlyMap<string, ReadonlyDeep<JsonObject>>;
  readonly revision: number;
  readonly schema: CollectionSchema<JsonObject>;
}

interface WorkingCollection {
  readonly baseRevision: number;
  indexes: Map<string, SecondaryIndexState>;
  order: string[];
  records: Map<string, ReadonlyDeep<JsonObject>>;
  readonly schema: CollectionSchema<JsonObject>;
}

interface SecondaryIndexState {
  readonly buckets: Map<string, Set<string>>;
  readonly name: string;
  readonly path: PropertyPath;
  readonly unique: boolean;
}

export interface QueryPlan {
  readonly index?: string;
  readonly strategy: "primary" | "scan" | "secondary";
}

interface QueryExecution<T extends JsonObject> {
  readonly documents: readonly ReadonlyDeep<T>[];
  readonly plan: QueryPlan;
}

interface QueryOptions {
  readonly limit?: number;
  readonly offset: number;
  readonly order?: readonly Readonly<{
    direction: "asc" | "desc";
    path: PropertyPath;
  }>[];
}

export interface CommitReceipt {
  readonly affected: number;
  readonly databaseId: string;
  readonly durability: "memory" | "persisted";
  readonly generatedKeys: readonly GeneratedKey[];
  readonly revision: number;
  readonly transactionId: string;
}

export interface GeneratedKey {
  readonly collection: string;
  readonly primaryKey: string;
}

export interface DatabaseOptions<Seed extends DatabaseSeed> {
  readonly eventLimits?: Partial<EventLimits>;
  readonly onEventOverflow?: (batch: ChangeBatch) => void;
  readonly onListenerError?: (error: unknown, batch: ChangeBatch) => void;
  readonly persistenceLimits?: Partial<PersistenceLimits>;
  readonly schema: DatabaseSchema<Seed>;
  readonly transactionLimits?: Partial<TransactionLimits>;
  /** Rebuild and verify internal indexes after every committed mutation. */
  readonly verifyInvariants?: boolean;
}

export interface DatabaseOpenOptions<
  Seed extends DatabaseSeed,
> extends DatabaseOptions<Seed> {
  readonly adapter: StorageAdapter<Seed>;
  readonly initialData?: Seed;
}

export interface TransactionOptions {
  readonly allowVolatileWhenDegraded?: boolean;
  readonly durability?: "memory" | "persisted";
}

export interface EventLimits {
  readonly maxQueuedBatches: number;
  readonly maxQueuedChanges: number;
}

export interface TransactionLimits {
  readonly maxAgeMs: number;
  readonly maxOperations: number;
  readonly maxReadCollections: number;
}

export interface PersistenceLimits {
  readonly maxPendingSnapshots: number;
}

const defaultEventLimits: EventLimits = Object.freeze({
  maxQueuedBatches: 1_024,
  maxQueuedChanges: 100_000,
});

const defaultTransactionLimits: TransactionLimits = Object.freeze({
  maxAgeMs: 30_000,
  maxOperations: 10_000,
  maxReadCollections: 1_000,
});

const defaultPersistenceLimits: PersistenceLimits = Object.freeze({
  maxPendingSnapshots: 256,
});

export type DatabaseState =
  "closed" | "closing" | "corrupt" | "degraded" | "open" | "opening";

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

function resolvedLimits(schema: CollectionSchema<JsonObject>): JsonLimits {
  return Object.freeze({ ...defaultJsonLimits, ...schema.limits });
}

function validateDocument(
  collection: string,
  document: JsonObject,
  schema: CollectionSchema<JsonObject>,
): ReadonlyDeep<JsonObject> {
  const cloned = cloneAndFreezeJsonObject(document, resolvedLimits(schema));
  if (schema.validate !== undefined) {
    try {
      schema.validate(cloned);
    } catch (error) {
      throw new SchemaValidationError(collection, { cause: error });
    }
  }
  documentKey(cloned, schema);
  return cloned;
}

function materializePrimaryKey(
  collection: string,
  input: JsonObject,
  schema: CollectionSchema<JsonObject>,
): Readonly<{ document: JsonObject; generatedKey?: string }> {
  const cloned = cloneAndFreezeJsonObject(input, resolvedLimits(schema));
  if (Object.hasOwn(cloned, schema.primaryKey)) return { document: cloned };
  const generator = schema.generatePrimaryKey;
  if (generator === undefined) return { document: cloned };
  const generatedKey = generator === true ? randomId() : generator();
  if (typeof generatedKey !== "string" || generatedKey.length === 0) {
    throw new InvalidArgumentError(
      `Generated primary key for ${collection} must be a non-empty string`,
    );
  }
  encodeKey(generatedKey);
  const document: JsonObject = Object.create(null) as JsonObject;
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(cloned),
  )) {
    if (!("value" in descriptor)) continue;
    Object.defineProperty(document, key, {
      enumerable: true,
      value: descriptor.value as JsonValue,
    });
  }
  Object.defineProperty(document, schema.primaryKey, {
    enumerable: true,
    value: generatedKey,
  });
  return Object.freeze({ document, generatedKey });
}

function indexValue(
  collection: string,
  index: SecondaryIndexState,
  document: ReadonlyDeep<JsonObject>,
): string | undefined {
  const value = readPath(document, index.path);
  if (value === undefined) return undefined;
  if (
    value !== null &&
    typeof value !== "boolean" &&
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new InvalidArgumentError(
      `Index ${collection}.${index.name} must resolve to a JSON primitive`,
    );
  }
  return encodeIndexValue(value);
}

function createIndexes(
  collection: string,
  schema: CollectionSchema<JsonObject>,
): Map<string, SecondaryIndexState> {
  const indexes = new Map<string, SecondaryIndexState>();
  for (const definition of schema.indexes ?? []) {
    if (definition.name.length === 0 || indexes.has(definition.name)) {
      throw new InvalidArgumentError(
        `Secondary index names must be non-empty and unique in ${collection}`,
      );
    }
    indexes.set(definition.name, {
      buckets: new Map(),
      name: definition.name,
      path: validatePath(definition.path),
      unique: definition.unique ?? false,
    });
  }
  return indexes;
}

function addToIndexes(
  collection: string,
  indexes: Map<string, SecondaryIndexState>,
  primaryKey: string,
  document: ReadonlyDeep<JsonObject>,
): void {
  const additions: [SecondaryIndexState, string][] = [];
  for (const index of indexes.values()) {
    const encoded = indexValue(collection, index, document);
    if (encoded === undefined) continue;
    const bucket = index.buckets.get(encoded);
    if (index.unique && bucket !== undefined && !bucket.has(primaryKey)) {
      throw new DuplicateUniqueIndexError(collection, index.name);
    }
    additions.push([index, encoded]);
  }
  for (const [index, encoded] of additions) {
    const bucket = index.buckets.get(encoded) ?? new Set<string>();
    bucket.add(primaryKey);
    index.buckets.set(encoded, bucket);
  }
}

function removeFromIndexes(
  collection: string,
  indexes: Map<string, SecondaryIndexState>,
  primaryKey: string,
  document: ReadonlyDeep<JsonObject>,
): void {
  for (const index of indexes.values()) {
    const encoded = indexValue(collection, index, document);
    if (encoded === undefined) continue;
    const bucket = index.buckets.get(encoded);
    bucket?.delete(primaryKey);
    if (bucket?.size === 0) index.buckets.delete(encoded);
  }
}

function cloneIndexes(
  indexes: ReadonlyMap<string, SecondaryIndexState>,
): Map<string, SecondaryIndexState> {
  return new Map(
    [...indexes].map(([name, index]) => [
      name,
      {
        ...index,
        buckets: new Map(
          [...index.buckets].map(([value, primaryKeys]) => [
            value,
            new Set(primaryKeys),
          ]),
        ),
      },
    ]),
  );
}

function assertCollectionInvariant(
  name: string,
  collection: StoredCollection,
): void {
  if (collection.order.length !== collection.records.size) {
    throw new InvariantViolationError(
      `${name}: record order cardinality mismatch`,
    );
  }
  const ordered = new Set(collection.order);
  if (ordered.size !== collection.order.length) {
    throw new InvariantViolationError(
      `${name}: record order contains duplicates`,
    );
  }
  for (const [key, document] of collection.records) {
    if (
      !ordered.has(key) ||
      encodeKey(documentKey(document, collection.schema)) !== key
    ) {
      throw new InvariantViolationError(
        `${name}: primary-key map is inconsistent`,
      );
    }
  }
  for (const index of collection.indexes.values()) {
    const expected = new Map<string, Set<string>>();
    for (const [key, document] of collection.records) {
      const encoded = indexValue(name, index, document);
      if (encoded === undefined) continue;
      const bucket = expected.get(encoded) ?? new Set<string>();
      bucket.add(key);
      expected.set(encoded, bucket);
    }
    if (expected.size !== index.buckets.size) {
      throw new InvariantViolationError(
        `${name}.${index.name}: bucket count mismatch`,
      );
    }
    for (const [value, keys] of expected) {
      const actual = index.buckets.get(value);
      if (
        actual?.size !== keys.size ||
        [...keys].some((key) => !actual.has(key))
      ) {
        throw new InvariantViolationError(
          `${name}.${index.name}: bucket contents mismatch`,
        );
      }
    }
  }
}

function createStoredCollection(
  name: string,
  documents: readonly JsonObject[],
  schema: CollectionSchema<JsonObject>,
  revision = 0,
): StoredCollection {
  const records = new Map<string, ReadonlyDeep<JsonObject>>();
  const order: string[] = [];
  const indexes = createIndexes(name, schema);
  for (const input of documents) {
    const document = validateDocument(name, input, schema);
    const key = documentKey(document, schema);
    const encoded = encodeKey(key);
    if (records.has(encoded)) throw new DuplicateKeyError(name, key);
    records.set(encoded, document);
    order.push(encoded);
    addToIndexes(name, indexes, encoded, document);
  }
  return Object.freeze({
    indexes,
    order: Object.freeze(order),
    records,
    revision,
    schema,
  });
}

function freezeChange(change: Change): Change {
  return Object.freeze(change);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function choosePlan<T extends JsonObject>(
  collection: StoredCollection,
  condition: Where<T>,
): QueryPlan {
  if (condition.op !== "eq" || Array.isArray(condition.value)) {
    return Object.freeze({ strategy: "scan" });
  }
  const primaryPath: PropertyPath = [collection.schema.primaryKey];
  if (samePath(condition.path, primaryPath)) {
    return Object.freeze({ strategy: "primary" });
  }
  for (const index of collection.indexes.values()) {
    if (samePath(condition.path, index.path)) {
      return Object.freeze({ index: index.name, strategy: "secondary" });
    }
  }
  return Object.freeze({ strategy: "scan" });
}

function compareJson(
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): number {
  if (left === right) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number")
    return left - right;
  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : 1;
  }
  if (typeof left === "boolean" && typeof right === "boolean")
    return left ? 1 : -1;
  const typeOrder = ["boolean", "number", "string", "object"];
  return typeOrder.indexOf(typeof left) - typeOrder.indexOf(typeof right);
}

export class Database<Seed extends DatabaseSeed> {
  readonly id: string;
  #collections: ReadonlyMap<string, StoredCollection>;
  #dispatchScheduled = false;
  #eventQueue: ChangeBatch[] = [];
  #eventQueueChanges = 0;
  #listenerId = 0;
  #listeners = new Map<number, ChangeListener>();
  #adapter?: StorageAdapter<Seed>;
  #catalog: ReturnType<typeof createCatalog>;
  #closePromise: Promise<void> | undefined;
  #generation = 0;
  #persistedRevision = 0;
  #persistenceTail: Promise<void> = Promise.resolve();
  #pendingPersistence = 0;
  #revision = 0;
  #state: DatabaseState = "open";
  #transactionCallbackActive = false;

  private constructor(
    seed: Seed,
    readonly options: DatabaseOptions<Seed>,
    stored?: Readonly<{
      databaseId: string;
      generation: number;
      revision: number;
    }>,
  ) {
    const maxPendingSnapshots = options.persistenceLimits?.maxPendingSnapshots;
    if (
      maxPendingSnapshots !== undefined &&
      (!Number.isSafeInteger(maxPendingSnapshots) || maxPendingSnapshots <= 0)
    ) {
      throw new InvalidArgumentError(
        "maxPendingSnapshots must be a positive safe integer",
      );
    }
    this.id = stored?.databaseId ?? randomId();
    this.#revision = stored?.revision ?? 0;
    this.#generation = stored?.generation ?? 0;
    this.#persistedRevision = stored?.revision ?? 0;
    this.#catalog = createCatalog(options.schema);
    const collections = new Map<string, StoredCollection>();
    for (const name of Object.keys(seed)) {
      const documents = seed[name];
      const schema = options.schema[name];
      if (documents === undefined || schema === undefined) {
        throw new InvalidArgumentError(
          `Missing collection data or schema for ${name}`,
        );
      }
      collections.set(
        name,
        createStoredCollection(name, documents, schema, this.#revision),
      );
    }
    for (const name of Object.keys(options.schema)) {
      if (!Object.hasOwn(seed, name)) {
        throw new InvalidArgumentError(
          `Schema references unknown collection ${name}`,
        );
      }
    }
    this.#collections = collections;
    this.verify();
  }

  static memory<Seed extends DatabaseSeed>(
    seed: Seed,
    options: DatabaseOptions<WidenSeed<Seed>>,
  ): Database<WidenSeed<Seed>> {
    return new Database(seed as unknown as WidenSeed<Seed>, options);
  }

  static async open<Seed extends DatabaseSeed>(
    options: DatabaseOpenOptions<Seed>,
  ): Promise<Database<Seed>> {
    const loaded = await options.adapter.load();
    const expectedCatalog = createCatalog(options.schema);
    if (loaded !== null && !catalogsEqual(loaded.catalog, expectedCatalog)) {
      await options.adapter.close();
      throw new CorruptStorageError(
        "The stored catalog does not match the supplied database schema",
      );
    }
    const seed = loaded?.collections ?? options.initialData;
    if (seed === undefined) {
      await options.adapter.close();
      throw new InvalidArgumentError(
        "initialData is required when persistent storage is empty",
      );
    }
    try {
      const database = new Database(seed, options, loaded ?? undefined);
      database.#adapter = options.adapter;
      if (loaded === null) database.#persistedRevision = -1;
      return database;
    } catch (error) {
      await options.adapter.close();
      throw new CorruptStorageError("The stored database snapshot is invalid", {
        cause: error,
      });
    }
  }

  get revision(): number {
    return this.#revision;
  }

  get state(): DatabaseState {
    return this.#state;
  }

  /** Reconstructs and validates all primary-key, ordering, and index invariants. */
  verify(): void {
    this.#assertOpen();
    for (const [name, collection] of this.#collections) {
      assertCollectionInvariant(name, collection);
    }
  }

  collection<Name extends keyof Seed & string>(
    name: Name,
  ): Collection<Seed, Name> {
    this.#assertOpen();
    this.#stored(name);
    return new Collection(this, name);
  }

  subscribe(listener: ChangeListener): () => void {
    this.#assertOpen();
    const id = ++this.#listenerId;
    this.#listeners.set(id, listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#listeners.delete(id);
    };
  }

  async transaction(
    callback: (transaction: Transaction<Seed>) => void,
    options: TransactionOptions = {},
  ): Promise<CommitReceipt> {
    this.#assertOpen();
    const durability =
      options.durability ??
      (this.#adapter === undefined ? "memory" : "persisted");
    if (
      this.#state === "degraded" &&
      (durability === "persisted" || !options.allowVolatileWhenDegraded)
    ) {
      throw new PersistenceError(
        Object.freeze({
          affected: 0,
          databaseId: this.id,
          durability: "memory",
          generatedKeys: Object.freeze([]),
          revision: this.#revision,
          transactionId: randomId(),
        }),
      );
    }
    if (this.#transactionCallbackActive) {
      throw new TransactionStateError(
        "Nested transaction callbacks are not supported",
      );
    }
    const transaction = this.beginTransaction();
    let result: unknown;
    try {
      this.#transactionCallbackActive = true;
      result = callback(transaction);
    } catch (error) {
      transaction.rollback();
      throw error;
    } finally {
      this.#transactionCallbackActive = false;
    }
    if (isPromiseLike(result)) {
      transaction.rollback();
      throw new TransactionCallbackError(
        "Transaction callbacks must be synchronous",
      );
    }
    const receipt = transaction.commit();
    if (durability === "memory") {
      return receipt;
    }
    if (this.#adapter === undefined) return receipt;
    if (this.#persistedRevision < receipt.revision)
      await this.#persist(receipt);
    return Object.freeze({ ...receipt, durability: "persisted" });
  }

  beginTransaction(): Transaction<Seed> {
    this.#assertOpen();
    return new Transaction(this, {
      ...defaultTransactionLimits,
      ...this.options.transactionLimits,
    });
  }

  async flush(): Promise<number> {
    this.#assertUsable();
    const target = this.#revision;
    if (this.#adapter !== undefined && this.#persistedRevision < target) {
      const receipt: CommitReceipt = Object.freeze({
        affected: 0,
        databaseId: this.id,
        durability: "memory",
        generatedKeys: Object.freeze([]),
        revision: target,
        transactionId: randomId(),
      });
      await this.#persist(receipt);
    } else {
      await this.#persistenceTail;
    }
    return target;
  }

  close(): Promise<void> {
    if (this.#state === "closed") return Promise.resolve();
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#state = "closing";
    this.#closePromise = this.#performClose();
    return this.#closePromise;
  }

  async #performClose(): Promise<void> {
    let failure: unknown;
    try {
      await this.flushDuringClose();
    } catch (error) {
      failure = error;
    }
    try {
      await this.#adapter?.close();
    } catch (error) {
      failure ??= error;
    }
    this.#listeners.clear();
    this.#eventQueue = [];
    this.#state = "closed";
    if (failure !== undefined) {
      throw failure instanceof Error
        ? failure
        : new StorageError("Closing persistent storage failed", {
            cause: failure,
          });
    }
  }

  /** @internal */
  _stored(name: string): StoredCollection {
    return this.#stored(name);
  }

  /** @internal */
  _query<T extends JsonObject>(
    name: string,
    condition: Where<T>,
    options: QueryOptions,
  ): QueryExecution<T> {
    this.#assertOpen();
    const collection = this.#stored(name);
    const compiled = compileWhere<T>(condition);
    const plan = choosePlan(collection, compiled.ast);
    let candidateKeys: readonly string[];
    if (plan.strategy === "primary") {
      const comparison = compiled.ast as ComparisonCondition<T>;
      try {
        candidateKeys = [encodeKey(comparison.value as PrimaryKey)];
      } catch {
        candidateKeys = [];
      }
    } else if (plan.strategy === "secondary" && plan.index !== undefined) {
      const comparison = compiled.ast as ComparisonCondition<T>;
      const index = collection.indexes.get(plan.index);
      const bucket = index?.buckets.get(
        encodeIndexValue(comparison.value as JsonPrimitive),
      );
      candidateKeys =
        bucket === undefined
          ? []
          : collection.order.filter((key) => bucket.has(key));
    } else {
      candidateKeys = collection.order;
    }

    let documents = candidateKeys
      .map((key) => collection.records.get(key) as ReadonlyDeep<T> | undefined)
      .filter((document): document is ReadonlyDeep<T> => document !== undefined)
      .filter(compiled.test);

    if (options.order !== undefined) {
      documents = documents
        .map((document, position) => ({ document, position }))
        .sort((left, right) => {
          for (const { direction, path } of options.order ?? []) {
            const compared = compareJson(
              readPath(left.document, path),
              readPath(right.document, path),
            );
            if (compared !== 0)
              return direction === "asc" ? compared : -compared;
          }
          const leftKey = documentKey(left.document, collection.schema);
          const rightKey = documentKey(right.document, collection.schema);
          const keyCompared = compareJson(leftKey, rightKey);
          return keyCompared === 0
            ? left.position - right.position
            : keyCompared;
        })
        .map(({ document }) => document);
    }

    const end =
      options.limit === undefined ? undefined : options.offset + options.limit;
    return Object.freeze({
      documents: Object.freeze(documents.slice(options.offset, end)),
      plan,
    });
  }

  /** @internal */
  _commit(
    working: ReadonlyMap<string, WorkingCollection>,
    baseRevisions: ReadonlyMap<string, number>,
    changes: readonly Change[],
    generatedKeys: readonly GeneratedKey[],
    transactionId: string,
  ): CommitReceipt {
    this.#assertOpen();
    const conflicts: string[] = [];
    for (const [name, baseRevision] of baseRevisions) {
      const current = this.#stored(name);
      if (current.revision !== baseRevision) conflicts.push(name);
    }
    if (conflicts.length > 0) {
      throw new ConflictError(Object.freeze(conflicts));
    }

    if (changes.length === 0) {
      return Object.freeze({
        affected: 0,
        databaseId: this.id,
        durability: "memory",
        generatedKeys: Object.freeze([...generatedKeys]),
        revision: this.#revision,
        transactionId,
      });
    }
    const revision = this.#revision + 1;
    const next = new Map(this.#collections);
    for (const [name, collection] of working) {
      next.set(
        name,
        Object.freeze({
          indexes: collection.indexes,
          order: Object.freeze([...collection.order]),
          records: collection.records,
          revision,
          schema: collection.schema,
        }),
      );
    }
    if (this.options.verifyInvariants) {
      for (const [name, collection] of next) {
        assertCollectionInvariant(name, collection);
      }
    }
    this.#collections = next;
    this.#revision = revision;

    const frozenChanges = Object.freeze(changes.map(freezeChange));
    const batch: ChangeBatch = Object.freeze({
      changes: frozenChanges,
      databaseId: this.id,
      revision,
      transactionId,
    });
    this.#enqueue(batch);
    return Object.freeze({
      affected: frozenChanges.length,
      databaseId: this.id,
      durability: "memory",
      generatedKeys: Object.freeze([...generatedKeys]),
      revision,
      transactionId,
    });
  }

  #assertOpen(): void {
    if (this.#state !== "open" && this.#state !== "degraded")
      throw new ClosedError();
  }

  #assertUsable(): void {
    if (this.#state !== "open" && this.#state !== "degraded")
      throw new ClosedError();
  }

  async flushDuringClose(): Promise<void> {
    if (this.#adapter === undefined) return;
    if (this.#persistedRevision < this.#revision) {
      const receipt: CommitReceipt = Object.freeze({
        affected: 0,
        databaseId: this.id,
        durability: "memory",
        generatedKeys: Object.freeze([]),
        revision: this.#revision,
        transactionId: randomId(),
      });
      await this.#persist(receipt);
    } else {
      await this.#persistenceTail;
    }
  }

  #persist(receipt: CommitReceipt): Promise<void> {
    const adapter = this.#adapter;
    if (adapter === undefined) return Promise.resolve();
    const limits = {
      ...defaultPersistenceLimits,
      ...this.options.persistenceLimits,
    };
    if (this.#pendingPersistence >= limits.maxPendingSnapshots) {
      this.#state = "degraded";
      return Promise.reject(
        new PersistenceError(receipt, {
          cause: new StorageError("The persistence queue is full"),
        }),
      );
    }
    this.#pendingPersistence += 1;
    const collections = cloneSnapshotCollections(this.#collections) as Seed;
    const task = this.#persistenceTail.then(async () => {
      const expectedGeneration = this.#generation;
      const snapshot: SnapshotEnvelope<Seed> = Object.freeze({
        catalog: this.#catalog,
        collections,
        databaseId: this.id,
        format: "newtondb",
        formatVersion: 1,
        generation: expectedGeneration + 1,
        revision: receipt.revision,
      });
      try {
        const acknowledgement = await adapter.store(snapshot, {
          expectedGeneration,
        });
        if (
          acknowledgement.databaseId !== this.id ||
          acknowledgement.generation !== snapshot.generation ||
          acknowledgement.revision < receipt.revision
        ) {
          throw new Error(
            "The storage adapter returned an invalid acknowledgement",
          );
        }
        this.#generation = acknowledgement.generation;
        this.#persistedRevision = Math.max(
          this.#persistedRevision,
          acknowledgement.revision,
        );
        if (
          this.#state === "degraded" &&
          this.#persistedRevision >= this.#revision
        ) {
          this.#state = "open";
        }
      } catch (error) {
        this.#state = "degraded";
        throw new PersistenceError(receipt, { cause: error });
      }
    });
    const counted = task.finally(() => {
      this.#pendingPersistence -= 1;
    });
    this.#persistenceTail = counted.catch(() => undefined);
    return counted;
  }

  #stored(name: string): StoredCollection {
    const collection = this.#collections.get(name);
    if (collection === undefined) {
      throw new InvalidArgumentError(`Unknown collection ${name}`);
    }
    return collection;
  }

  #enqueue(batch: ChangeBatch): void {
    const limits = { ...defaultEventLimits, ...this.options.eventLimits };
    if (
      this.#eventQueue.length >= limits.maxQueuedBatches ||
      this.#eventQueueChanges + batch.changes.length > limits.maxQueuedChanges
    ) {
      this.options.onEventOverflow?.(batch);
      return;
    }
    this.#eventQueue.push(batch);
    this.#eventQueueChanges += batch.changes.length;
    if (this.#dispatchScheduled) return;
    this.#dispatchScheduled = true;
    queueMicrotask(() => {
      try {
        while (this.#eventQueue.length > 0) {
          const current = this.#eventQueue.shift();
          if (current === undefined) continue;
          this.#eventQueueChanges -= current.changes.length;
          for (const listener of [...this.#listeners.values()]) {
            try {
              listener(current);
            } catch (error) {
              this.options.onListenerError?.(error, current);
            }
          }
        }
      } finally {
        this.#dispatchScheduled = false;
      }
    });
  }
}

export class Collection<
  Seed extends DatabaseSeed,
  Name extends keyof Seed & string,
> {
  constructor(
    private readonly database: Database<Seed>,
    readonly name: Name,
  ) {}

  get count(): number {
    return this.database._stored(this.name).records.size;
  }

  get(
    primaryKey: PrimaryKey,
  ): ReadonlyDeep<DocumentOf<Seed, Name>> | undefined {
    return this.database
      ._stored(this.name)
      .records.get(encodeKey(primaryKey)) as
      ReadonlyDeep<DocumentOf<Seed, Name>> | undefined;
  }

  getOrThrow(primaryKey: PrimaryKey): ReadonlyDeep<DocumentOf<Seed, Name>> {
    const document = this.get(primaryKey);
    if (document === undefined) throw new NotFoundError(this.name, primaryKey);
    return document;
  }

  has(primaryKey: PrimaryKey): boolean {
    return this.get(primaryKey) !== undefined;
  }

  toArray(): readonly ReadonlyDeep<DocumentOf<Seed, Name>>[] {
    const collection = this.database._stored(this.name);
    return Object.freeze(
      collection.order.map(
        (key) =>
          collection.records.get(key) as ReadonlyDeep<DocumentOf<Seed, Name>>,
      ),
    );
  }

  query(condition: Where<DocumentOf<Seed, Name>>): Query<Seed, Name> {
    return new Query(this.database, this.name, condition);
  }

  filter(
    predicate: LocalPredicate<DocumentOf<Seed, Name>>,
  ): readonly ReadonlyDeep<DocumentOf<Seed, Name>>[] {
    return Object.freeze(this.toArray().filter(predicate.test));
  }

  insert(
    document: InsertDocument<DocumentOf<Seed, Name>>,
  ): Promise<CommitReceipt> {
    return this.database.transaction((transaction) => {
      transaction.collection(this.name).insert(document);
    });
  }

  update(
    primaryKey: PrimaryKey,
    patch: Partial<DocumentOf<Seed, Name>>,
  ): Promise<CommitReceipt> {
    return this.database.transaction((transaction) => {
      transaction.collection(this.name).update(primaryKey, patch);
    });
  }

  delete(primaryKey: PrimaryKey): Promise<CommitReceipt> {
    return this.database.transaction((transaction) => {
      transaction.collection(this.name).delete(primaryKey);
    });
  }
}

export class Query<
  Seed extends DatabaseSeed,
  Name extends keyof Seed & string,
> {
  constructor(
    private readonly database: Database<Seed>,
    readonly collectionName: Name,
    readonly condition: Where<DocumentOf<Seed, Name>>,
    private readonly options: QueryOptions = { offset: 0 },
  ) {}

  limit(amount: number): Query<Seed, Name> {
    assertNonNegativeInteger(amount, "limit");
    return new Query(this.database, this.collectionName, this.condition, {
      ...this.options,
      limit: amount,
    });
  }

  offset(amount: number): Query<Seed, Name> {
    assertNonNegativeInteger(amount, "offset");
    return new Query(this.database, this.collectionName, this.condition, {
      ...this.options,
      offset: amount,
    });
  }

  orderBy(
    field: keyof DocumentOf<Seed, Name> & string,
    direction: "asc" | "desc" = "asc",
  ): Query<Seed, Name> {
    return new Query(this.database, this.collectionName, this.condition, {
      ...this.options,
      order: Object.freeze([
        Object.freeze({ direction, path: validatePath([field]) }),
      ]),
    });
  }

  thenBy(
    field: keyof DocumentOf<Seed, Name> & string,
    direction: "asc" | "desc" = "asc",
  ): Query<Seed, Name> {
    if (this.options.order === undefined) {
      throw new InvalidArgumentError("thenBy() requires orderBy() first");
    }
    return new Query(this.database, this.collectionName, this.condition, {
      ...this.options,
      order: Object.freeze([
        ...this.options.order,
        Object.freeze({ direction, path: validatePath([field]) }),
      ]),
    });
  }

  explain(): QueryPlan {
    return this.database._query<DocumentOf<Seed, Name>>(
      this.collectionName,
      this.condition,
      { ...this.options, limit: 0 },
    ).plan;
  }

  toArray(): readonly ReadonlyDeep<DocumentOf<Seed, Name>>[] {
    return this.database._query<DocumentOf<Seed, Name>>(
      this.collectionName,
      this.condition,
      this.options,
    ).documents;
  }
}

type TransactionStatus = "active" | "committed" | "rolledBack";

export class Transaction<Seed extends DatabaseSeed> {
  readonly id = randomId();
  #baseRevisions = new Map<string, number>();
  #changes: Change[] = [];
  #generatedKeys: GeneratedKey[] = [];
  readonly #createdAt = Date.now();
  #operations = 0;
  #status: TransactionStatus = "active";
  #working = new Map<string, WorkingCollection>();

  /** Construct transactions with `Database.beginTransaction()`. */
  constructor(
    private readonly database: Database<Seed>,
    private readonly limits: TransactionLimits,
  ) {}

  collection<Name extends keyof Seed & string>(
    name: Name,
  ): TransactionCollection<Seed, Name> {
    this.#assertActive();
    this.database._stored(name);
    return new TransactionCollection(this, name);
  }

  rollback(): void {
    if (this.#status !== "active") return;
    this.#status = "rolledBack";
    this.#working.clear();
    this.#changes = [];
    this.#generatedKeys = [];
  }

  commit(): CommitReceipt {
    this.#assertActive();
    this.#assertWithinLimits();
    try {
      const receipt = this.database._commit(
        this.#working,
        this.#baseRevisions,
        this.#changes,
        this.#generatedKeys,
        this.id,
      );
      this.#status = "committed";
      return receipt;
    } catch (error) {
      this.#status = "rolledBack";
      throw error;
    }
  }

  /** @internal */
  _read(
    name: string,
    primaryKey: PrimaryKey,
  ): ReadonlyDeep<JsonObject> | undefined {
    this.#assertActive();
    this.#touchCollection(name);
    const collection = this.#working.get(name) ?? this.database._stored(name);
    return collection.records.get(encodeKey(primaryKey));
  }

  /** @internal */
  _query(name: string, condition: Where): readonly ReadonlyDeep<JsonObject>[] {
    this.#touchCollection(name);
    const collection = this.#working.get(name) ?? this.database._stored(name);
    const compiled = compileWhere(condition);
    return Object.freeze(
      collection.order
        .map((key) => collection.records.get(key))
        .filter(
          (document): document is ReadonlyDeep<JsonObject> =>
            document !== undefined,
        )
        .filter(compiled.test),
    );
  }

  /** @internal */
  _insert(name: string, input: JsonObject, upsert: boolean): PrimaryKey {
    this.#recordOperation();
    const collection = this.#writable(name);
    const materialized = materializePrimaryKey(name, input, collection.schema);
    const document = validateDocument(
      name,
      materialized.document,
      collection.schema,
    );
    const primaryKey = documentKey(document, collection.schema);
    const encoded = encodeKey(primaryKey);
    const before = collection.records.get(encoded);
    if (before !== undefined && !upsert)
      throw new DuplicateKeyError(name, primaryKey);
    if (before !== undefined)
      removeFromIndexes(name, collection.indexes, encoded, before);
    try {
      addToIndexes(name, collection.indexes, encoded, document);
    } catch (error) {
      if (before !== undefined)
        addToIndexes(name, collection.indexes, encoded, before);
      throw error;
    }
    collection.records.set(encoded, document);
    if (before === undefined) collection.order.push(encoded);
    this.#changes.push(
      freezeChange({
        ...(before === undefined ? {} : { before }),
        after: document,
        collection: name,
        operation: before === undefined ? "insert" : "update",
        primaryKey,
      }),
    );
    if (materialized.generatedKey !== undefined) {
      this.#generatedKeys.push(
        Object.freeze({
          collection: name,
          primaryKey: materialized.generatedKey,
        }),
      );
    }
    return primaryKey;
  }

  /** @internal */
  _update(
    name: string,
    primaryKey: PrimaryKey,
    patch: Partial<JsonObject>,
  ): void {
    this.#recordOperation();
    const collection = this.#writable(name);
    const encoded = encodeKey(primaryKey);
    const before = collection.records.get(encoded);
    if (before === undefined) throw new NotFoundError(name, primaryKey);
    const candidate = mergeDocument(before, patch);
    const after = validateDocument(name, candidate, collection.schema);
    if (documentKey(after, collection.schema) !== primaryKey) {
      throw new ImmutablePrimaryKeyError(name);
    }
    removeFromIndexes(name, collection.indexes, encoded, before);
    try {
      addToIndexes(name, collection.indexes, encoded, after);
    } catch (error) {
      addToIndexes(name, collection.indexes, encoded, before);
      throw error;
    }
    collection.records.set(encoded, after);
    this.#changes.push(
      freezeChange({
        after,
        before,
        collection: name,
        operation: "update",
        primaryKey,
      }),
    );
  }

  /** @internal */
  _delete(name: string, primaryKey: PrimaryKey): void {
    this.#recordOperation();
    const collection = this.#writable(name);
    const encoded = encodeKey(primaryKey);
    const before = collection.records.get(encoded);
    if (before === undefined) throw new NotFoundError(name, primaryKey);
    removeFromIndexes(name, collection.indexes, encoded, before);
    collection.records.delete(encoded);
    const position = collection.order.indexOf(encoded);
    if (position >= 0) collection.order.splice(position, 1);
    this.#changes.push(
      freezeChange({
        before,
        collection: name,
        operation: "delete",
        primaryKey,
      }),
    );
  }

  #assertActive(): void {
    if (this.#status !== "active") {
      throw new TransactionStateError(`Transaction is ${this.#status}`);
    }
  }

  #assertWithinLimits(): void {
    if (Date.now() - this.#createdAt > this.limits.maxAgeMs) {
      throw new TransactionStateError("Transaction exceeded its maximum age");
    }
  }

  #recordOperation(): void {
    this.#assertActive();
    this.#assertWithinLimits();
    this.#operations += 1;
    if (this.#operations > this.limits.maxOperations) {
      throw new TransactionStateError(
        "Transaction exceeded its operation limit",
      );
    }
  }

  #touchCollection(name: string): StoredCollection {
    this.#assertActive();
    this.#assertWithinLimits();
    const stored = this.database._stored(name);
    if (!this.#baseRevisions.has(name)) {
      if (this.#baseRevisions.size >= this.limits.maxReadCollections) {
        throw new TransactionStateError(
          "Transaction exceeded its read-collection limit",
        );
      }
      this.#baseRevisions.set(name, stored.revision);
    }
    return stored;
  }

  #writable(name: string): WorkingCollection {
    this.#assertActive();
    const existing = this.#working.get(name);
    if (existing !== undefined) return existing;
    const stored = this.#touchCollection(name);
    const working: WorkingCollection = {
      baseRevision: stored.revision,
      indexes: cloneIndexes(stored.indexes),
      order: [...stored.order],
      records: new Map(stored.records),
      schema: stored.schema,
    };
    this.#working.set(name, working);
    return working;
  }
}

export class TransactionCollection<
  Seed extends DatabaseSeed,
  Name extends keyof Seed & string,
> {
  constructor(
    private readonly transaction: Transaction<Seed>,
    readonly name: Name,
  ) {}

  get(
    primaryKey: PrimaryKey,
  ): ReadonlyDeep<DocumentOf<Seed, Name>> | undefined {
    return this.transaction._read(this.name, primaryKey) as
      ReadonlyDeep<DocumentOf<Seed, Name>> | undefined;
  }

  find(
    condition: Where<DocumentOf<Seed, Name>>,
  ): readonly ReadonlyDeep<DocumentOf<Seed, Name>>[] {
    return this.transaction._query(
      this.name,
      condition,
    ) as readonly ReadonlyDeep<DocumentOf<Seed, Name>>[];
  }

  insert(document: InsertDocument<DocumentOf<Seed, Name>>): PrimaryKey {
    return this.transaction._insert(this.name, document, false);
  }

  upsert(document: InsertDocument<DocumentOf<Seed, Name>>): PrimaryKey {
    return this.transaction._insert(this.name, document, true);
  }

  update(primaryKey: PrimaryKey, patch: Partial<DocumentOf<Seed, Name>>): void {
    this.transaction._update(this.name, primaryKey, patch);
  }

  delete(primaryKey: PrimaryKey): void {
    this.transaction._delete(this.name, primaryKey);
  }
}

function mergeDocument(
  before: ReadonlyDeep<JsonObject>,
  patch: Partial<JsonObject>,
): JsonObject {
  const candidate: unknown = patch;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new InvalidArgumentError("An update patch must be a plain object");
  }
  const patchPrototype = Object.getPrototypeOf(patch) as unknown;
  if (patchPrototype !== Object.prototype && patchPrototype !== null) {
    throw new InvalidArgumentError("An update patch must be a plain object");
  }
  const output: JsonObject = Object.create(null) as JsonObject;
  for (const [key, value] of Object.entries(before)) {
    Object.defineProperty(output, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }
  const descriptors = Object.getOwnPropertyDescriptors(patch);
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new InvalidArgumentError("Update patches cannot contain accessors");
    }
    Object.defineProperty(output, key, {
      configurable: true,
      enumerable: true,
      value: descriptor.value as JsonObject[string],
      writable: true,
    });
  }
  return output;
}
