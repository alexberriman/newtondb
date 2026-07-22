import { describe, expect, it, vi } from "vitest";

import {
  ConflictError,
  Database,
  TransactionStateError,
  collectionSchema,
  where,
  type ChangeBatch,
  type ChangeListener,
} from "../src/index.js";

type Account = { balance: number; id: string };
type Audit = { id: string; message: string };

function createDatabase(
  options: {
    eventLimits?: { maxQueuedBatches: number; maxQueuedChanges: number };
    onEventOverflow?: (batch: ChangeBatch) => void;
    transactionLimits?: {
      maxAgeMs: number;
      maxOperations: number;
      maxReadCollections: number;
    };
  } = {},
) {
  return Database.memory(
    {
      accounts: [
        { balance: 100, id: "a" } satisfies Account,
        { balance: 100, id: "b" } satisfies Account,
      ],
      audits: [] as Audit[],
    },
    {
      ...options,
      schema: {
        accounts: collectionSchema<Account>({ primaryKey: "id" }),
        audits: collectionSchema<Audit>({ primaryKey: "id" }),
      },
    },
  );
}

describe("transaction histories", () => {
  it("rejects a stale point-read transaction without publishing any writes", async () => {
    const db = createDatabase();
    const stale = db.beginTransaction();
    expect(stale.collection("accounts").get("a")?.balance).toBe(100);

    await db.collection("accounts").update("a", { balance: 90 });
    stale
      .collection("audits")
      .insert({ id: "stale", message: "should not publish" });

    expect(() => stale.commit()).toThrow(
      expect.objectContaining({
        code: "ERR_CONFLICT",
        collections: ["accounts"],
      }),
    );
    expect(db.collection("audits").has("stale")).toBe(false);
    expect(db.revision).toBe(1);
  });

  it("tracks predicate reads and prevents phantoms/write skew", async () => {
    const db = createDatabase();
    const stale = db.beginTransaction();
    const accounts = stale
      .collection("accounts")
      .find(where<Account>().gte("balance", 100));
    expect(accounts).toHaveLength(2);

    await db.collection("accounts").insert({ balance: 100, id: "c" });
    stale
      .collection("audits")
      .insert({ id: "predicate", message: "stale predicate" });

    expect(() => stale.commit()).toThrow(ConflictError);
    expect(db.collection("audits").has("predicate")).toBe(false);
  });

  it("matches a deterministic collection-revision history oracle", () => {
    const db = createDatabase();
    type Pending = {
      readonly baseBalance: number;
      readonly baseRevision: number;
      readonly transaction: ReturnType<typeof db.beginTransaction>;
    };
    const pending: Pending[] = [];
    let modelBalance = 100;
    let modelRevision = 0;
    let successes = 0;
    let conflicts = 0;
    let random = 0x5eed_2026;
    const nextRandom = () => {
      random = (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0;
      return random;
    };

    for (let step = 0; step < 500; step += 1) {
      if (pending.length === 0 || nextRandom() % 3 !== 0) {
        const transaction = db.beginTransaction();
        const baseBalance = transaction
          .collection("accounts")
          .get("a")?.balance;
        expect(baseBalance).toBeDefined();
        pending.push({
          baseBalance: baseBalance ?? 0,
          baseRevision: modelRevision,
          transaction,
        });
        continue;
      }
      const position = nextRandom() % pending.length;
      const [current] = pending.splice(position, 1);
      if (current === undefined) throw new Error("history selection invariant");
      current.transaction
        .collection("accounts")
        .update("a", { balance: current.baseBalance + 1 });
      const shouldCommit = current.baseRevision === modelRevision;
      if (shouldCommit) {
        expect(() => current.transaction.commit()).not.toThrow();
        modelBalance += 1;
        modelRevision += 1;
        successes += 1;
      } else {
        expect(() => current.transaction.commit()).toThrow(ConflictError);
        conflicts += 1;
      }
    }

    for (const current of pending) current.transaction.rollback();
    expect({ conflicts, successes }).toEqual({ conflicts: 140, successes: 24 });
    expect(db.collection("accounts").get("a")?.balance).toBe(modelBalance);
    expect(db.revision).toBe(modelRevision);
  });

  it("publishes 100 concurrently requested independent commits without loss", async () => {
    const db = createDatabase();
    const commits = Array.from({ length: 100 }, (_, index) =>
      db
        .collection("audits")
        .insert({ id: `audit-${index}`, message: "recorded" }),
    );
    const receipts = await Promise.all(commits);

    expect(receipts.map(({ revision }) => revision)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(db.collection("audits").count).toBe(100);
    expect(db.revision).toBe(100);
  });

  it("does not allow an unresolved listener promise to delay commits", async () => {
    const db = createDatabase();
    const never = new Promise<void>(() => undefined);
    const slowListener = (() => never) as ChangeListener;
    db.subscribe(slowListener);

    await expect(
      db.collection("audits").insert({ id: "slow", message: "listener" }),
    ).resolves.toMatchObject({ revision: 1 });
    expect(db.collection("audits").has("slow")).toBe(true);
  });

  it("supports read-your-writes and atomic cross-collection publication", () => {
    const db = createDatabase();
    const transaction = db.beginTransaction();

    transaction.collection("accounts").update("a", { balance: 75 });
    transaction
      .collection("audits")
      .insert({ id: "transfer", message: "debited" });

    expect(transaction.collection("accounts").get("a")?.balance).toBe(75);
    expect(db.collection("accounts").get("a")?.balance).toBe(100);

    const receipt = transaction.commit();
    expect(receipt.affected).toBe(2);
    expect(db.collection("accounts").get("a")?.balance).toBe(75);
    expect(db.collection("audits").has("transfer")).toBe(true);
  });

  it("rejects repeated use and allows idempotent rollback", () => {
    const db = createDatabase();
    const committed = db.beginTransaction();
    committed.collection("audits").insert({ id: "one", message: "one" });
    committed.commit();

    expect(() => committed.commit()).toThrow(TransactionStateError);
    expect(() => committed.collection("accounts")).toThrow(
      TransactionStateError,
    );

    const rolledBack = db.beginTransaction();
    rolledBack.rollback();
    rolledBack.rollback();
    expect(() => rolledBack.commit()).toThrow(TransactionStateError);
  });

  it("does not advance revision or emit an event for read-only transactions", () => {
    const db = createDatabase();
    const listener = vi.fn();
    db.subscribe(listener);
    const transaction = db.beginTransaction();
    transaction.collection("accounts").get("a");

    const receipt = transaction.commit();

    expect(receipt).toMatchObject({ affected: 0, revision: 0 });
    expect(db.revision).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it("enforces operation, read-collection, and age limits", () => {
    vi.useFakeTimers();
    try {
      const db = createDatabase({
        transactionLimits: {
          maxAgeMs: 10,
          maxOperations: 1,
          maxReadCollections: 1,
        },
      });
      const operations = db.beginTransaction();
      operations.collection("accounts").update("a", { balance: 99 });
      expect(() =>
        operations.collection("accounts").update("b", { balance: 99 }),
      ).toThrow(TransactionStateError);

      const reads = db.beginTransaction();
      reads.collection("accounts").get("a");
      expect(() => reads.collection("audits").get("none")).toThrow(
        TransactionStateError,
      );

      const aged = db.beginTransaction();
      vi.advanceTimersByTime(11);
      expect(() => aged.commit()).toThrow(TransactionStateError);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("transaction event batches", () => {
  it("delivers revision-ordered batches and queues reentrant writes", async () => {
    const db = createDatabase();
    const revisions: number[] = [];
    db.subscribe((batch) => {
      revisions.push(batch.revision);
      if (batch.revision === 1) {
        void db
          .collection("audits")
          .insert({ id: "reentrant", message: "queued" });
      }
    });

    const first = db.beginTransaction();
    first.collection("accounts").update("a", { balance: 80 });
    first.commit();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(revisions).toEqual([1, 2]);
    expect(db.collection("audits").has("reentrant")).toBe(true);
  });

  it("snapshots subscribers for the current batch", async () => {
    const db = createDatabase();
    const calls: string[] = [];
    db.subscribe(() => {
      calls.push("first");
      unsubscribeSecond();
    });
    const unsubscribeSecond = db.subscribe(() => calls.push("second"));

    await db.collection("accounts").update("a", { balance: 99 });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await db.collection("accounts").update("a", { balance: 98 });
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(calls).toEqual(["first", "second", "first"]);
  });

  it("bounds queued batches and reports omitted overflow", async () => {
    const overflow = vi.fn();
    const db = createDatabase({
      eventLimits: { maxQueuedBatches: 1, maxQueuedChanges: 10 },
      onEventOverflow: overflow,
    });
    const listener = vi.fn();
    db.subscribe(listener);

    const first = db.beginTransaction();
    first.collection("accounts").update("a", { balance: 99 });
    first.commit();
    const second = db.beginTransaction();
    second.collection("accounts").update("b", { balance: 99 });
    second.commit();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(listener).toHaveBeenCalledOnce();
    expect(overflow).toHaveBeenCalledOnce();
    expect(db.revision).toBe(2);
  });
});
