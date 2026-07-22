import { describe, expect, it } from "vitest";

import {
  Database,
  collectionSchema,
  createCatalog,
  type SnapshotEnvelope,
} from "../src/index.js";
import {
  FaultInjectionAdapter,
  MemoryStorage,
  MemoryStorageAdapter,
  verifyStorageAdapterConformance,
} from "../src/testing/index.js";

type RecordDocument = { id: string; value: number };
type Seed = { records: RecordDocument[] };

const schema = {
  records: collectionSchema<RecordDocument>({ primaryKey: "id" }),
};

function snapshot(): SnapshotEnvelope<Seed> {
  return {
    catalog: createCatalog<Seed>(schema),
    collections: { records: [{ id: "one", value: 1 }] },
    databaseId: "conformance-database",
    format: "newtondb",
    formatVersion: 1,
    generation: 1,
    revision: 1,
  };
}

describe("storage adapter conformance kit", () => {
  it("certifies the reference memory adapter", async () => {
    const storage = new MemoryStorage<Seed>();
    const report = await verifyStorageAdapterConformance(
      () => new MemoryStorageAdapter(storage),
      snapshot(),
    );

    expect(report.checks).toEqual([
      "empty-load",
      "conditional-store",
      "reopen",
      "stale-generation",
      "idempotent-close",
    ]);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.checks)).toBe(true);
  });

  it("detaches and recursively freezes values at the adapter boundary", async () => {
    const adapter = new MemoryStorageAdapter<Seed>();
    await adapter.load();
    const input = snapshot();
    await adapter.store(input, { expectedGeneration: 0 });
    const inputRecord = input.collections.records[0];
    if (inputRecord === undefined) throw new Error("fixture invariant");
    inputRecord.value = 999;

    await adapter.close();
    const reopened = new MemoryStorageAdapter(adapter.storage);
    const loaded = await reopened.load();
    expect(loaded?.collections.records[0]?.value).toBe(1);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded?.collections.records[0])).toBe(true);
  });

  it("injects rejection after memory publication with an honest receipt", async () => {
    const storage = new MemoryStorage<Seed>();
    const wrapped = new FaultInjectionAdapter(
      new MemoryStorageAdapter(storage),
      {
        before(call) {
          if (call.operation === "store") throw new Error("injected rejection");
        },
      },
    );
    const database = await Database.open<Seed>({
      adapter: wrapped,
      initialData: { records: [] },
      schema,
    });

    await expect(
      database.collection("records").insert({ id: "one", value: 1 }),
    ).rejects.toMatchObject({
      code: "ERR_PERSISTENCE",
      receipt: { revision: 1 },
    });
    expect(database.collection("records").has("one")).toBe(true);
    expect(wrapped.calls.map(({ operation }) => operation)).toEqual([
      "load",
      "store",
    ]);
  });

  it("supports controlled delay and invalid acknowledgement injection", async () => {
    const storage = new MemoryStorage<Seed>();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delayed = new FaultInjectionAdapter(
      new MemoryStorageAdapter(storage),
      {
        async before(call) {
          if (call.operation === "store") await gate;
        },
      },
    );
    const database = await Database.open<Seed>({
      adapter: delayed,
      initialData: { records: [] },
      schema,
    });
    let settled = false;
    const commit = database
      .collection("records")
      .insert({ id: "one", value: 1 })
      .finally(() => {
        settled = true;
      });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await commit;

    const badAck = new FaultInjectionAdapter(new MemoryStorageAdapter<Seed>(), {
      after(call, result) {
        return call.operation === "store"
          ? { databaseId: "wrong", generation: 1, revision: 1 }
          : result;
      },
    });
    const invalid = await Database.open<Seed>({
      adapter: badAck,
      initialData: { records: [] },
      schema,
    });
    await expect(
      invalid.collection("records").insert({ id: "one", value: 1 }),
    ).rejects.toMatchObject({ code: "ERR_PERSISTENCE" });
  });
});
