import { describe, expect, expectTypeOf, it } from "vitest";

import {
  Database,
  DuplicateKeyError,
  InvalidArgumentError,
  collectionSchema,
  type CommitReceipt,
} from "../src/index.js";

type Note = { id: string; text: string };

describe("generated primary keys", () => {
  it("generates stable UUID keys and reports them in the immutable receipt", async () => {
    const db = Database.memory(
      { notes: [] as Note[] },
      {
        schema: {
          notes: collectionSchema<Note>({
            generatePrimaryKey: true,
            primaryKey: "id",
          }),
        },
      },
    );

    const promise = db.collection("notes").insert({ text: "gravity" });
    expectTypeOf(promise).toEqualTypeOf<Promise<CommitReceipt>>();
    const receipt = await promise;
    const generated = receipt.generatedKeys[0];

    expect(generated).toMatchObject({ collection: "notes" });
    expect(generated?.primaryKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(db.collection("notes").get(generated?.primaryKey ?? "")).toEqual({
      id: generated?.primaryKey,
      text: "gravity",
    });
    expect(Object.isFrozen(receipt.generatedKeys)).toBe(true);
    expect(Object.isFrozen(generated)).toBe(true);
  });

  it("supports deterministic generators and transaction-local returned keys", async () => {
    let sequence = 0;
    const db = Database.memory(
      { notes: [] as Note[] },
      {
        schema: {
          notes: collectionSchema<Note>({
            generatePrimaryKey: () => `note-${++sequence}`,
            primaryKey: "id",
          }),
        },
      },
    );
    const returned: string[] = [];
    const receipt = await db.transaction((transaction) => {
      returned.push(
        transaction.collection("notes").insert({ text: "first" }) as string,
      );
      returned.push(
        transaction.collection("notes").upsert({ text: "second" }) as string,
      );
      transaction.collection("notes").insert({ id: "manual", text: "third" });
    });

    expect(returned).toEqual(["note-1", "note-2"]);
    expect(receipt.generatedKeys).toEqual([
      { collection: "notes", primaryKey: "note-1" },
      { collection: "notes", primaryKey: "note-2" },
    ]);
    expect(db.collection("notes").count).toBe(3);
  });

  it("rejects invalid or duplicate generated keys without publication", async () => {
    const invalid = Database.memory(
      { notes: [] as Note[] },
      {
        schema: {
          notes: collectionSchema<Note>({
            generatePrimaryKey: () => "",
            primaryKey: "id",
          }),
        },
      },
    );
    await expect(
      invalid.collection("notes").insert({ text: "invalid" }),
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    expect(invalid.revision).toBe(0);

    const duplicate = Database.memory(
      { notes: [] as Note[] },
      {
        schema: {
          notes: collectionSchema<Note>({
            generatePrimaryKey: () => "same",
            primaryKey: "id",
          }),
        },
      },
    );
    await duplicate.collection("notes").insert({ text: "first" });
    await expect(
      duplicate.collection("notes").insert({ text: "second" }),
    ).rejects.toBeInstanceOf(DuplicateKeyError);
    expect(duplicate.collection("notes").toArray()).toEqual([
      { id: "same", text: "first" },
    ]);
    expect(duplicate.revision).toBe(1);
  });
});
