import {
  ClosedError,
  ConflictError,
  DuplicateKeyError,
  DuplicateUniqueIndexError,
  ImmutablePrimaryKeyError,
  InvalidArgumentError,
  NotFoundError,
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
  type ComparisonCondition,
  type Where,
} from "./query.js";
import {
  type CollectionSchema,
  type DatabaseSchema,
  type DatabaseSeed,
  type DocumentOf,
  type PrimaryKey,
  type WidenSeed,
} from "./schema.js";

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
  readonly order?: Readonly<{ direction: "asc" | "desc"; path: PropertyPath }>;
}

export interface CommitReceipt {
  readonly affected: number;
  readonly databaseId: string;
  readonly durability: "memory";
  readonly revision: number;
  readonly transactionId: string;
}

export interface DatabaseOptions<Seed extends DatabaseSeed> {
  readonly eventLimits?: Partial<EventLimits>;
  readonly onEventOverflow?: (batch: ChangeBatch) => void;
  readonly onListenerError?: (error: unknown, batch: ChangeBatch) => void;
  readonly schema: DatabaseSchema<Seed>;
  readonly transactionLimits?: Partial<TransactionLimits>;
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

const defaultEventLimits: EventLimits = Object.freeze({
  maxQueuedBatches: 1_024,
  maxQueuedChanges: 100_000,
});

const defaultTransactionLimits: TransactionLimits = Object.freeze({
  maxAgeMs: 30_000,
  maxOperations: 10_000,
  maxReadCollections: 1_000,
});

type DatabaseState = "closed" | "closing" | "open";

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

function createStoredCollection(
  name: string,
  documents: readonly JsonObject[],
  schema: CollectionSchema<JsonObject>,
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
    revision: 0,
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
  #revision = 0;
  #state: DatabaseState = "open";
  #transactionCallbackActive = false;

  private constructor(
    seed: Seed,
    readonly options: DatabaseOptions<Seed>,
  ) {
    this.id = randomId();
    const collections = new Map<string, StoredCollection>();
    for (const name of Object.keys(seed)) {
      const documents = seed[name];
      const schema = options.schema[name];
      if (documents === undefined || schema === undefined) {
        throw new InvalidArgumentError(
          `Missing collection data or schema for ${name}`,
        );
      }
      collections.set(name, createStoredCollection(name, documents, schema));
    }
    for (const name of Object.keys(options.schema)) {
      if (!Object.hasOwn(seed, name)) {
        throw new InvalidArgumentError(
          `Schema references unknown collection ${name}`,
        );
      }
    }
    this.#collections = collections;
  }

  static memory<Seed extends DatabaseSeed>(
    seed: Seed,
    options: DatabaseOptions<WidenSeed<Seed>>,
  ): Database<WidenSeed<Seed>> {
    return new Database(seed as unknown as WidenSeed<Seed>, options);
  }

  get revision(): number {
    return this.#revision;
  }

  get state(): DatabaseState {
    return this.#state;
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
  ): Promise<CommitReceipt> {
    this.#assertOpen();
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
    return transaction.commit();
  }

  beginTransaction(): Transaction<Seed> {
    this.#assertOpen();
    return new Transaction(this, {
      ...defaultTransactionLimits,
      ...this.options.transactionLimits,
    });
  }

  async flush(): Promise<number> {
    this.#assertOpen();
    return this.#revision;
  }

  async close(): Promise<void> {
    if (this.#state === "closed") return;
    if (this.#state === "closing") return;
    this.#state = "closing";
    this.#listeners.clear();
    this.#eventQueue = [];
    this.#state = "closed";
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
      const { direction, path } = options.order;
      documents = documents
        .map((document, position) => ({ document, position }))
        .sort((left, right) => {
          const compared = compareJson(
            readPath(left.document, path),
            readPath(right.document, path),
          );
          if (compared !== 0) return direction === "asc" ? compared : -compared;
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
      revision,
      transactionId,
    });
  }

  #assertOpen(): void {
    if (this.#state !== "open") throw new ClosedError();
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

  insert(document: DocumentOf<Seed, Name>): Promise<CommitReceipt> {
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
      order: Object.freeze({
        direction,
        path: validatePath([field]),
      }),
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
  }

  commit(): CommitReceipt {
    this.#assertActive();
    this.#assertWithinLimits();
    try {
      const receipt = this.database._commit(
        this.#working,
        this.#baseRevisions,
        this.#changes,
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
  _insert(name: string, input: JsonObject, upsert: boolean): void {
    this.#recordOperation();
    const collection = this.#writable(name);
    const document = validateDocument(name, input, collection.schema);
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

  insert(document: DocumentOf<Seed, Name>): void {
    this.transaction._insert(this.name, document, false);
  }

  upsert(document: DocumentOf<Seed, Name>): void {
    this.transaction._insert(this.name, document, true);
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
