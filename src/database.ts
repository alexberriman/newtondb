import {
  ClosedError,
  ConflictError,
  DuplicateKeyError,
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
  type ReadonlyDeep,
} from "./json.js";
import { documentKey, encodeKey } from "./key.js";
import {
  type CollectionSchema,
  type DatabaseSchema,
  type DatabaseSeed,
  type DocumentOf,
  type PrimaryKey,
  type WidenSeed,
} from "./schema.js";

interface StoredCollection {
  readonly order: readonly string[];
  readonly records: ReadonlyMap<string, ReadonlyDeep<JsonObject>>;
  readonly revision: number;
  readonly schema: CollectionSchema<JsonObject>;
}

interface WorkingCollection {
  readonly baseRevision: number;
  order: string[];
  records: Map<string, ReadonlyDeep<JsonObject>>;
  readonly schema: CollectionSchema<JsonObject>;
}

export interface CommitReceipt {
  readonly affected: number;
  readonly databaseId: string;
  readonly durability: "memory";
  readonly revision: number;
  readonly transactionId: string;
}

export interface DatabaseOptions<Seed extends DatabaseSeed> {
  readonly onListenerError?: (error: unknown, batch: ChangeBatch) => void;
  readonly schema: DatabaseSchema<Seed>;
}

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

function createStoredCollection(
  name: string,
  documents: readonly JsonObject[],
  schema: CollectionSchema<JsonObject>,
): StoredCollection {
  const records = new Map<string, ReadonlyDeep<JsonObject>>();
  const order: string[] = [];
  for (const input of documents) {
    const document = validateDocument(name, input, schema);
    const key = documentKey(document, schema);
    const encoded = encodeKey(key);
    if (records.has(encoded)) throw new DuplicateKeyError(name, key);
    records.set(encoded, document);
    order.push(encoded);
  }
  return Object.freeze({
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

export class Database<Seed extends DatabaseSeed> {
  readonly id: string;
  #collections: ReadonlyMap<string, StoredCollection>;
  #dispatchScheduled = false;
  #eventQueue: ChangeBatch[] = [];
  #listenerId = 0;
  #listeners = new Map<number, ChangeListener>();
  #revision = 0;
  #state: DatabaseState = "open";

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
    const transaction = new Transaction(this);
    let result: unknown;
    try {
      result = callback(transaction);
    } catch (error) {
      transaction.rollback();
      throw error;
    }
    if (isPromiseLike(result)) {
      transaction.rollback();
      throw new TransactionCallbackError(
        "Transaction callbacks must be synchronous",
      );
    }
    return transaction.commit();
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
  _commit(
    working: ReadonlyMap<string, WorkingCollection>,
    readCollections: ReadonlySet<string>,
    changes: readonly Change[],
    transactionId: string,
  ): CommitReceipt {
    this.#assertOpen();
    const conflicts: string[] = [];
    for (const name of new Set([...readCollections, ...working.keys()])) {
      const current = this.#stored(name);
      const baseRevision = working.get(name)?.baseRevision ?? current.revision;
      if (current.revision !== baseRevision) conflicts.push(name);
    }
    if (conflicts.length > 0) {
      throw new ConflictError(Object.freeze(conflicts));
    }

    const revision = this.#revision + 1;
    const next = new Map(this.#collections);
    for (const [name, collection] of working) {
      next.set(
        name,
        Object.freeze({
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
    this.#eventQueue.push(batch);
    if (this.#dispatchScheduled) return;
    this.#dispatchScheduled = true;
    queueMicrotask(() => {
      try {
        while (this.#eventQueue.length > 0) {
          const current = this.#eventQueue.shift();
          if (current === undefined) continue;
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

type TransactionStatus = "active" | "committed" | "rolledBack";

export class Transaction<Seed extends DatabaseSeed> {
  readonly id = randomId();
  #changes: Change[] = [];
  #reads = new Set<string>();
  #status: TransactionStatus = "active";
  #working = new Map<string, WorkingCollection>();

  constructor(private readonly database: Database<Seed>) {}

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
    try {
      const receipt = this.database._commit(
        this.#working,
        this.#reads,
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
    this.#reads.add(name);
    const collection = this.#working.get(name) ?? this.database._stored(name);
    return collection.records.get(encodeKey(primaryKey));
  }

  /** @internal */
  _insert(name: string, input: JsonObject, upsert: boolean): void {
    const collection = this.#writable(name);
    const document = validateDocument(name, input, collection.schema);
    const primaryKey = documentKey(document, collection.schema);
    const encoded = encodeKey(primaryKey);
    const before = collection.records.get(encoded);
    if (before !== undefined && !upsert)
      throw new DuplicateKeyError(name, primaryKey);
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
    const collection = this.#writable(name);
    const encoded = encodeKey(primaryKey);
    const before = collection.records.get(encoded);
    if (before === undefined) throw new NotFoundError(name, primaryKey);
    const candidate = mergeDocument(before, patch);
    const after = validateDocument(name, candidate, collection.schema);
    if (documentKey(after, collection.schema) !== primaryKey) {
      throw new ImmutablePrimaryKeyError(name);
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
    const collection = this.#writable(name);
    const encoded = encodeKey(primaryKey);
    const before = collection.records.get(encoded);
    if (before === undefined) throw new NotFoundError(name, primaryKey);
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

  #writable(name: string): WorkingCollection {
    this.#assertActive();
    this.#reads.add(name);
    const existing = this.#working.get(name);
    if (existing !== undefined) return existing;
    const stored = this.database._stored(name);
    const working: WorkingCollection = {
      baseRevision: stored.revision,
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
