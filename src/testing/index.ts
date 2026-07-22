import {
  ClosedError,
  CorruptStorageError,
  StorageConflictError,
  StorageError,
} from "../errors.js";
import type { DatabaseSeed } from "../schema.js";
import {
  isSnapshotEnvelope,
  type SnapshotEnvelope,
  type StorageAdapter,
  type StoreAcknowledgement,
} from "../storage.js";

export type {
  CatalogCollection,
  DatabaseCatalog,
  DatabaseSeed,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  SnapshotEnvelope,
  StorageAdapter,
  StoreAcknowledgement,
} from "../index.js";
export { snapshotFormat, snapshotFormatVersion } from "../index.js";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const descriptor of Object.values(
      Object.getOwnPropertyDescriptors(value),
    )) {
      if ("value" in descriptor) deepFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

function cloneSnapshot<Seed extends DatabaseSeed>(
  snapshot: SnapshotEnvelope<Seed>,
): SnapshotEnvelope<Seed> {
  const clone: unknown = structuredClone(snapshot);
  if (!isSnapshotEnvelope(clone)) {
    throw new CorruptStorageError(
      "Snapshot failed the storage envelope contract",
    );
  }
  return deepFreeze(clone as SnapshotEnvelope<Seed>);
}

/** Shared volatile backing state used to simulate reopen across adapter instances. */
export class MemoryStorage<Seed extends DatabaseSeed> {
  /** @internal */
  snapshot: SnapshotEnvelope<Seed> | null = null;
}

/** A conditional-store reference adapter with explicitly non-durable semantics. */
export class MemoryStorageAdapter<
  Seed extends DatabaseSeed,
> implements StorageAdapter<Seed> {
  #closed = false;
  #loaded = false;

  constructor(readonly storage = new MemoryStorage<Seed>()) {}

  async load(): Promise<SnapshotEnvelope<Seed> | null> {
    this.#assertOpen();
    if (this.#loaded)
      throw new StorageError("Adapter has already loaded storage");
    this.#loaded = true;
    return this.storage.snapshot === null
      ? null
      : cloneSnapshot(this.storage.snapshot);
  }

  async store(
    snapshot: SnapshotEnvelope<Seed>,
    options: Readonly<{ expectedGeneration: number }>,
  ): Promise<StoreAcknowledgement> {
    this.#assertOpen();
    if (!this.#loaded) throw new StorageError("load() must precede store()");
    const current = this.storage.snapshot;
    if (
      (current?.generation ?? 0) !== options.expectedGeneration ||
      snapshot.generation !== options.expectedGeneration + 1 ||
      (current !== null && current.databaseId !== snapshot.databaseId)
    ) {
      throw new StorageConflictError();
    }
    const stored = cloneSnapshot(snapshot);
    this.storage.snapshot = stored;
    return deepFreeze({
      databaseId: stored.databaseId,
      generation: stored.generation,
      revision: stored.revision,
    });
  }

  async close(): Promise<void> {
    this.#closed = true;
  }

  #assertOpen(): void {
    if (this.#closed) throw new ClosedError();
  }
}

export type StorageOperation = "close" | "load" | "store";

export interface StorageCall {
  readonly operation: StorageOperation;
  readonly sequence: number;
}

export interface StorageFaultController {
  after?: (call: StorageCall, result: unknown) => unknown;
  before?: (call: StorageCall) => Promise<void> | void;
}

/** Programmable wrapper for delay, rejection, hanging, and bad-ack tests. */
export class FaultInjectionAdapter<
  Seed extends DatabaseSeed,
> implements StorageAdapter<Seed> {
  readonly calls: StorageCall[] = [];
  #sequence = 0;

  constructor(
    readonly adapter: StorageAdapter<Seed>,
    readonly controller: StorageFaultController,
  ) {}

  async load(
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<SnapshotEnvelope<Seed> | null> {
    return (await this.#invoke("load", () =>
      this.adapter.load(options),
    )) as SnapshotEnvelope<Seed> | null;
  }

  async store(
    snapshot: SnapshotEnvelope<Seed>,
    options: Readonly<{ expectedGeneration: number; signal?: AbortSignal }>,
  ): Promise<StoreAcknowledgement> {
    return (await this.#invoke("store", () =>
      this.adapter.store(snapshot, options),
    )) as StoreAcknowledgement;
  }

  async close(): Promise<void> {
    await this.#invoke("close", () => this.adapter.close());
  }

  async #invoke(operation: StorageOperation, invoke: () => Promise<unknown>) {
    const call = deepFreeze({ operation, sequence: ++this.#sequence });
    this.calls.push(call);
    await this.controller.before?.(call);
    const result = await invoke();
    return (await this.controller.after?.(call, result)) ?? result;
  }
}

export interface AdapterConformanceReport {
  readonly checks: readonly [
    "empty-load",
    "conditional-store",
    "reopen",
    "stale-generation",
    "idempotent-close",
  ];
}

/** Runs the minimum mutable-adapter contract without depending on a test framework. */
export async function verifyStorageAdapterConformance<
  Seed extends DatabaseSeed,
>(
  create: () => StorageAdapter<Seed>,
  snapshot: SnapshotEnvelope<Seed>,
): Promise<AdapterConformanceReport> {
  const first = create();
  if ((await first.load()) !== null) {
    throw new StorageError("Conformance fixture must begin empty");
  }
  const acknowledgement = await first.store(snapshot, {
    expectedGeneration: 0,
  });
  if (
    acknowledgement.databaseId !== snapshot.databaseId ||
    acknowledgement.generation !== snapshot.generation ||
    acknowledgement.revision !== snapshot.revision
  ) {
    throw new StorageError(
      "Adapter acknowledgement does not bind the snapshot",
    );
  }
  await first.close();
  await first.close();

  const reopened = create();
  const loaded = await reopened.load();
  if (loaded === null || JSON.stringify(loaded) !== JSON.stringify(snapshot)) {
    throw new StorageError(
      "Adapter did not reproduce the stored snapshot on reopen",
    );
  }
  let conflicted = false;
  try {
    await reopened.store(snapshot, { expectedGeneration: 0 });
  } catch {
    conflicted = true;
  }
  if (!conflicted) {
    throw new StorageError("Adapter accepted a stale expected generation");
  }
  await reopened.close();
  return deepFreeze({
    checks: [
      "empty-load",
      "conditional-store",
      "reopen",
      "stale-generation",
      "idempotent-close",
    ],
  });
}
