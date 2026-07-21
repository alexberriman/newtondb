import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Database, collectionSchema } from "../src/index.js";

type Item = { id: number; value: string };

type Operation =
  | { kind: "delete"; id: number }
  | { kind: "insert"; id: number; value: string }
  | { kind: "upsert"; id: number; value: string }
  | { kind: "update"; id: number; value: string };

const operation = fc.oneof(
  fc.record({
    id: fc.integer({ min: 0, max: 20 }),
    kind: fc.constant("delete" as const),
  }),
  fc.record({
    id: fc.integer({ min: 0, max: 20 }),
    kind: fc.constant("insert" as const),
    value: fc.string({ maxLength: 20 }),
  }),
  fc.record({
    id: fc.integer({ min: 0, max: 20 }),
    kind: fc.constant("upsert" as const),
    value: fc.string({ maxLength: 20 }),
  }),
  fc.record({
    id: fc.integer({ min: 0, max: 20 }),
    kind: fc.constant("update" as const),
    value: fc.string({ maxLength: 20 }),
  }),
);

describe("memory engine model", () => {
  it("matches an independent Map model across randomized operation sequences", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(operation, { maxLength: 100 }),
        async (operations: Operation[]) => {
          const db = Database.memory(
            { items: [] as Item[] },
            { schema: { items: collectionSchema<Item>({ primaryKey: "id" }) } },
          );
          const model = new Map<number, Item>();
          const order: number[] = [];

          for (const current of operations) {
            let modelFailed = false;
            try {
              switch (current.kind) {
                case "insert":
                  if (model.has(current.id)) throw new Error("duplicate");
                  model.set(current.id, {
                    id: current.id,
                    value: current.value,
                  });
                  order.push(current.id);
                  break;
                case "upsert":
                  if (!model.has(current.id)) order.push(current.id);
                  model.set(current.id, {
                    id: current.id,
                    value: current.value,
                  });
                  break;
                case "update": {
                  const existing = model.get(current.id);
                  if (existing === undefined) throw new Error("missing");
                  model.set(current.id, { ...existing, value: current.value });
                  break;
                }
                case "delete":
                  if (!model.delete(current.id)) throw new Error("missing");
                  order.splice(order.indexOf(current.id), 1);
                  break;
              }
            } catch {
              modelFailed = true;
            }

            let databaseFailed = false;
            try {
              await db.transaction((tx) => {
                const items = tx.collection("items");
                switch (current.kind) {
                  case "insert":
                    items.insert({ id: current.id, value: current.value });
                    break;
                  case "upsert":
                    items.upsert({ id: current.id, value: current.value });
                    break;
                  case "update":
                    items.update(current.id, { value: current.value });
                    break;
                  case "delete":
                    items.delete(current.id);
                    break;
                }
              });
            } catch {
              databaseFailed = true;
            }

            expect(databaseFailed).toBe(modelFailed);
            expect(db.collection("items").toArray()).toEqual(
              order.map((id) => model.get(id)),
            );
            expect(db.collection("items").count).toBe(model.size);
          }
        },
      ),
      { numRuns: 100, seed: 20_260_722 },
    );
  });
});
