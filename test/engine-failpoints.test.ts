import { afterEach, describe, expect, it } from "vitest";

import { Database, collectionSchema } from "../src/index.js";
import {
  type EngineFailpoint,
  setEngineFailpointHandler,
} from "../src/internal/failpoints.js";

type Item = { id: number; value: string };

const schema = {
  items: collectionSchema<Item>({
    indexes: [{ name: "by-value", path: ["value"], unique: true }],
    primaryKey: "id",
  }),
};

const cases: readonly Readonly<{
  action: (database: Database<{ items: Item[] }>) => Promise<unknown>;
  points: readonly EngineFailpoint[];
}>[] = [
  {
    action: (database) =>
      database.collection("items").insert({ id: 2, value: "second" }),
    points: [
      "insert:before-validation",
      "insert:after-validation",
      "insert:before-index-add",
      "insert:after-index-add",
      "insert:before-record-write",
      "insert:after-record-write",
      "transaction:before-publish",
    ],
  },
  {
    action: (database) =>
      database.collection("items").update(1, { value: "changed" }),
    points: [
      "update:before-validation",
      "update:after-validation",
      "update:before-index-remove",
      "update:after-index-remove",
      "update:before-index-add",
      "update:after-index-add",
      "update:before-record-write",
      "update:after-record-write",
      "transaction:before-publish",
    ],
  },
  {
    action: (database) => database.collection("items").delete(1),
    points: [
      "delete:before-index-remove",
      "delete:after-index-remove",
      "delete:before-record-delete",
      "delete:after-record-delete",
      "transaction:before-publish",
    ],
  },
];

afterEach(() => setEngineFailpointHandler(undefined));

describe("named engine failpoints", () => {
  for (const scenario of cases) {
    for (const point of scenario.points) {
      it(`rolls back without publication at ${point}`, async () => {
        const database = Database.memory(
          { items: [{ id: 1, value: "first" }] },
          { schema, verifyInvariants: true },
        );
        const before = database.collection("items").toArray();
        setEngineFailpointHandler((reached) => {
          if (reached === point) throw new Error(`injected:${point}`);
        });

        await expect(scenario.action(database)).rejects.toThrow(
          `injected:${point}`,
        );
        setEngineFailpointHandler(undefined);

        expect(database.collection("items").toArray()).toEqual(before);
        expect(database.collection("items").count).toBe(1);
        expect(() => database.verify()).not.toThrow();
      });
    }
  }
});
