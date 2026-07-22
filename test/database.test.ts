import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  ClosedError,
  Database,
  DuplicateKeyError,
  ImmutablePrimaryKeyError,
  NotFoundError,
  SchemaValidationError,
  TransactionCallbackError,
  collectionSchema,
  type ChangeBatch,
} from "../src/index.js";

type User = {
  active: boolean;
  id: string;
  name: string;
};

type Post = {
  authorId: string;
  id: number;
  title: string;
};

function createDatabase(
  options: {
    eventDocuments?: "include" | "omit";
    onListenerError?: (error: unknown, batch: ChangeBatch) => void;
  } = {},
) {
  return Database.memory(
    {
      posts: [{ authorId: "u1", id: 1, title: "Principia" } satisfies Post],
      users: [{ active: true, id: "u1", name: "Isaac" } satisfies User],
    },
    {
      ...options,
      schema: {
        posts: collectionSchema<Post>({ primaryKey: "id" }),
        users: collectionSchema<User>({ primaryKey: "id" }),
      },
    },
  );
}

describe("Database.memory", () => {
  it("rejects invalid or safety-ceiling limit overrides at construction", () => {
    const seed = { users: [] as User[] };
    const base = collectionSchema<User>({ primaryKey: "id" });
    expect(() =>
      Database.memory(seed, {
        eventLimits: { maxQueuedBatches: 0 },
        schema: { users: base },
      }),
    ).toThrow(/event limit/u);
    expect(() =>
      Database.memory(seed, {
        schema: { users: base },
        transactionLimits: { maxOperations: Number.POSITIVE_INFINITY },
      }),
    ).toThrow(/transaction limit/u);
    expect(() =>
      Database.memory(seed, {
        schema: {
          users: collectionSchema<User>({
            limits: { maxDocumentBytes: 1_048_577 },
            primaryKey: "id",
          }),
        },
      }),
    ).toThrow(/JSON limit/u);
  });

  it("provides inferred, immutable primary-key reads", () => {
    const db = createDatabase();
    const user = db.collection("users").get("u1");

    expectTypeOf(user).toEqualTypeOf<Readonly<User> | undefined>();
    expect(user).toEqual({ active: true, id: "u1", name: "Isaac" });
    expect(Object.isFrozen(user)).toBe(true);
    expect(db.collection("users").get("missing")).toBeUndefined();
    expect(() => db.collection("users").getOrThrow("missing")).toThrow(
      NotFoundError,
    );
  });

  it("detaches seed data and preserves deterministic insertion order", async () => {
    const input: User = { active: true, id: "u1", name: "Isaac" };
    const db = Database.memory(
      { users: [input] },
      { schema: { users: collectionSchema<User>({ primaryKey: "id" }) } },
    );
    input.name = "mutated";

    await db
      .collection("users")
      .insert({ active: true, id: "u2", name: "Albert" });

    expect(
      db
        .collection("users")
        .toArray()
        .map(({ id }) => id),
    ).toEqual(["u1", "u2"]);
    expect(db.collection("users").get("u1")?.name).toBe("Isaac");
  });

  it("rejects duplicate keys during load and insert", async () => {
    expect(() =>
      Database.memory(
        {
          users: [
            { active: true, id: "duplicate", name: "one" },
            { active: false, id: "duplicate", name: "two" },
          ],
        },
        { schema: { users: collectionSchema<User>({ primaryKey: "id" }) } },
      ),
    ).toThrow(DuplicateKeyError);

    const db = createDatabase();
    await expect(
      db
        .collection("users")
        .insert({ active: false, id: "u1", name: "duplicate" }),
    ).rejects.toBeInstanceOf(DuplicateKeyError);
    expect(db.revision).toBe(0);
  });

  it("updates, upserts, and deletes atomically", async () => {
    const db = createDatabase();

    const receipt = await db.transaction((tx) => {
      tx.collection("users").update("u1", { active: false });
      tx.collection("users").upsert({ active: true, id: "u2", name: "Albert" });
      tx.collection("posts").delete(1);
    });

    expect(receipt).toMatchObject({
      affected: 3,
      durability: "memory",
      revision: 1,
    });
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(db.collection("users").get("u1")?.active).toBe(false);
    expect(db.collection("users").get("u2")?.name).toBe("Albert");
    expect(db.collection("posts").count).toBe(0);
  });

  it("provides collection-level findMany and upsert conveniences", async () => {
    const db = createDatabase();
    await db.collection("users").upsert({
      active: true,
      id: "u2",
      name: "Albert",
    });
    await db.collection("users").upsert({
      active: false,
      id: "u1",
      name: "Isaac Newton",
    });

    expect(
      db
        .collection("users")
        .findMany({ op: "eq", path: ["active"], value: true })
        .map(({ id }) => id),
    ).toEqual(["u2"]);
    expect(db.collection("users").get("u1")?.name).toBe("Isaac Newton");
  });

  it("publishes none of a transaction when a later operation fails", async () => {
    const db = createDatabase();

    await expect(
      db.transaction((tx) => {
        tx.collection("users").update("u1", { active: false });
        tx.collection("posts").delete(999);
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(db.revision).toBe(0);
    expect(db.collection("users").get("u1")?.active).toBe(true);
    expect(db.collection("posts").has(1)).toBe(true);
  });

  it("rejects primary-key changes without altering committed state", async () => {
    const db = createDatabase();

    await expect(
      db.collection("users").update("u1", { id: "u2" }),
    ).rejects.toBeInstanceOf(ImmutablePrimaryKeyError);
    expect(db.collection("users").get("u1")?.id).toBe("u1");
    expect(db.collection("users").get("u2")).toBeUndefined();
  });

  it("runs collection schema validators before publication", async () => {
    const db = Database.memory(
      { users: [{ active: true, id: "u1", name: "Isaac" }] },
      {
        schema: {
          users: collectionSchema<User>({
            primaryKey: "id",
            validate(user) {
              if (user.name.length < 2) throw new Error("name too short");
            },
          }),
        },
      },
    );

    await expect(
      db.collection("users").update("u1", { name: "x" }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
    expect(db.collection("users").get("u1")?.name).toBe("Isaac");
  });

  it("rejects asynchronous transaction callbacks", async () => {
    const db = createDatabase();
    type Callback = Parameters<typeof db.transaction>[0];
    type Tx = Parameters<Callback>[0];
    const asynchronousCallback = async (tx: Tx) => {
      tx.collection("users").update("u1", { active: false });
    };

    await expect(
      db.transaction(asynchronousCallback as unknown as Callback),
    ).rejects.toBeInstanceOf(TransactionCallbackError);
    expect(db.collection("users").get("u1")?.active).toBe(true);
  });

  it("delivers one frozen batch and isolates listener failures", async () => {
    const listenerError = vi.fn();
    const listener = vi.fn();
    const db = createDatabase({ onListenerError: listenerError });
    db.subscribe(() => {
      throw new Error("listener failed");
    });
    const unsubscribe = db.subscribe(listener);

    await db.collection("users").update("u1", { active: false });
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(listener).toHaveBeenCalledOnce();
    const batch = listener.mock.calls[0]?.[0] as ChangeBatch;
    expect(batch).toMatchObject({
      revision: 1,
      changes: [{ operation: "update" }],
    });
    expect(Object.isFrozen(batch)).toBe(true);
    expect(Object.isFrozen(batch.changes)).toBe(true);
    expect(batch.changes[0]).not.toHaveProperty("before");
    expect(batch.changes[0]).not.toHaveProperty("after");
    expect(listenerError).toHaveBeenCalledOnce();

    unsubscribe();
    unsubscribe();
    await db.collection("users").update("u1", { active: true });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("includes event document snapshots only by explicit opt-in", async () => {
    const listener = vi.fn();
    const db = createDatabase({ eventDocuments: "include" });
    db.subscribe(listener);

    await db.collection("users").update("u1", { active: false });
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    const change = (listener.mock.calls[0]?.[0] as ChangeBatch).changes[0];
    expect(change?.before).toMatchObject({ active: true, id: "u1" });
    expect(change?.after).toMatchObject({ active: false, id: "u1" });
    expect(Object.isFrozen(change?.before)).toBe(true);
    expect(Object.isFrozen(change?.after)).toBe(true);
  });

  it("closes idempotently and rejects later operations", async () => {
    const db = createDatabase();

    await db.close();
    await db.close();

    expect(db.state).toBe("closed");
    expect(() => db.collection("users")).toThrow(ClosedError);
    await expect(db.flush()).rejects.toBeInstanceOf(ClosedError);
  });
});
