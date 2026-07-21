import { describe, expect, it, vi } from "vitest";

import {
  CorruptStorageError,
  Database,
  PersistenceError,
  collectionSchema,
  type SnapshotEnvelope,
  type StorageAdapter,
} from "../src/index.js";

type User = { id: string; name: string };
type Seed = { users: User[] };

class MemoryAdapter implements StorageAdapter<Seed> {
  closed = false;
  closeGate: Promise<void> = Promise.resolve();
  failStores = 0;
  storeGate: Promise<void> = Promise.resolve();
  snapshot: SnapshotEnvelope<Seed> | null;
  readonly stores: SnapshotEnvelope<Seed>[] = [];

  constructor(snapshot: SnapshotEnvelope<Seed> | null = null) {
    this.snapshot = snapshot;
  }

  async close(): Promise<void> {
    await this.closeGate;
    this.closed = true;
  }

  async load(): Promise<SnapshotEnvelope<Seed> | null> {
    return this.snapshot;
  }

  async store(
    snapshot: SnapshotEnvelope<Seed>,
    options: Readonly<{ expectedGeneration: number }>,
  ) {
    await this.storeGate;
    if (this.failStores-- > 0) throw new Error("injected write failure");
    if ((this.snapshot?.generation ?? 0) !== options.expectedGeneration) {
      throw new Error("generation conflict");
    }
    this.snapshot = snapshot;
    this.stores.push(snapshot);
    return {
      databaseId: snapshot.databaseId,
      generation: snapshot.generation,
      revision: snapshot.revision,
    };
  }
}

const schema = {
  users: collectionSchema<User>({ primaryKey: "id" }),
};

function open(adapter: MemoryAdapter) {
  return Database.open<Seed>({
    adapter,
    initialData: { users: [{ id: "u1", name: "Isaac" }] },
    schema,
  });
}

describe("persistent database lifecycle", () => {
  it("persists by default and reopens the acknowledged snapshot", async () => {
    const adapter = new MemoryAdapter();
    const db = await open(adapter);

    const receipt = await db.collection("users").insert({
      id: "u2",
      name: "Albert",
    });

    expect(receipt).toMatchObject({ durability: "persisted", revision: 1 });
    expect(adapter.snapshot).toMatchObject({
      databaseId: db.id,
      format: "newtondb",
      formatVersion: 1,
      generation: 1,
      revision: 1,
    });
    expect(adapter.snapshot?.collections.users).toEqual([
      { id: "u1", name: "Isaac" },
      { id: "u2", name: "Albert" },
    ]);

    const reopened = await Database.open<Seed>({ adapter, schema });
    expect(reopened.id).toBe(db.id);
    expect(reopened.revision).toBe(1);
    expect(reopened.collection("users").get("u2")?.name).toBe("Albert");
  });

  it("reports a committed receipt when persistence fails, then recovers on flush", async () => {
    const adapter = new MemoryAdapter();
    const db = await open(adapter);
    adapter.failStores = 1;

    await expect(
      db.collection("users").insert({ id: "u2", name: "Albert" }),
    ).rejects.toMatchObject({
      code: "ERR_PERSISTENCE",
      receipt: { affected: 1, durability: "memory", revision: 1 },
    });
    expect(db.state).toBe("degraded");
    expect(db.collection("users").has("u2")).toBe(true);
    expect(adapter.snapshot).toBeNull();

    await expect(db.flush()).resolves.toBe(1);
    expect(db.state).toBe("open");
    expect(adapter.snapshot?.revision).toBe(1);
  });

  it("requires an explicit opt-in for volatile commits while degraded", async () => {
    const adapter = new MemoryAdapter();
    const db = await open(adapter);
    adapter.failStores = 1;
    await expect(
      db.collection("users").insert({ id: "u2", name: "Albert" }),
    ).rejects.toBeInstanceOf(PersistenceError);

    const callback = vi.fn();
    await expect(
      db.transaction(callback, { durability: "memory" }),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(callback).not.toHaveBeenCalled();

    const receipt = await db.transaction(
      (transaction) => {
        transaction.collection("users").insert({ id: "u3", name: "Marie" });
      },
      { allowVolatileWhenDegraded: true, durability: "memory" },
    );
    expect(receipt).toMatchObject({ durability: "memory", revision: 2 });
  });

  it("serializes concurrent stores without losing either revision", async () => {
    const adapter = new MemoryAdapter();
    const db = await open(adapter);

    const first = db.collection("users").insert({ id: "u2", name: "Albert" });
    const second = db.collection("users").insert({ id: "u3", name: "Marie" });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);

    expect(
      adapter.stores.map(({ generation, revision }) => [generation, revision]),
    ).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(adapter.snapshot?.collections.users).toHaveLength(3);
  });

  it("rejects a catalog mismatch and closes the adapter", async () => {
    const adapter = new MemoryAdapter();
    const db = await open(adapter);
    await db.collection("users").insert({ id: "u2", name: "Albert" });
    const snapshot = adapter.snapshot;
    expect(snapshot).not.toBeNull();
    if (snapshot === null) return;
    adapter.snapshot = {
      ...snapshot,
      catalog: {
        users: { indexes: [], primaryKey: "different" },
      },
    };

    await expect(
      Database.open<Seed>({ adapter, schema }),
    ).rejects.toBeInstanceOf(CorruptStorageError);
    expect(adapter.closed).toBe(true);
  });

  it("flushes pending volatile work before closing and closes idempotently", async () => {
    const adapter = new MemoryAdapter();
    const db = await open(adapter);
    await db.transaction(
      (transaction) => {
        transaction.collection("users").insert({ id: "u2", name: "Albert" });
      },
      { durability: "memory" },
    );

    await db.close();
    await db.close();
    expect(adapter.snapshot?.revision).toBe(1);
    expect(adapter.closed).toBe(true);
    expect(db.state).toBe("closed");
  });

  it("joins concurrent close calls", async () => {
    const adapter = new MemoryAdapter();
    let release: (value?: void | PromiseLike<void>) => void = () => undefined;
    adapter.closeGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const db = await open(adapter);

    const first = db.close();
    const second = db.close();
    expect(second).toBe(first);
    expect(db.state).toBe("closing");
    release();
    await first;
    expect(db.state).toBe("closed");
  });

  it("bounds queued snapshots and recovers the rejected committed revision", async () => {
    const adapter = new MemoryAdapter();
    let release: (value?: void | PromiseLike<void>) => void = () => undefined;
    adapter.storeGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const db = await Database.open<Seed>({
      adapter,
      initialData: { users: [{ id: "u1", name: "Isaac" }] },
      persistenceLimits: { maxPendingSnapshots: 1 },
      schema,
    });

    const first = db.collection("users").insert({ id: "u2", name: "Albert" });
    await expect(
      db.collection("users").insert({ id: "u3", name: "Marie" }),
    ).rejects.toMatchObject({
      code: "ERR_PERSISTENCE",
      receipt: { revision: 2 },
    });
    expect(db.state).toBe("degraded");

    release();
    await first;
    expect(db.state).toBe("degraded");
    await db.flush();
    expect(db.state).toBe("open");
    expect(adapter.snapshot?.revision).toBe(2);
  });
});
