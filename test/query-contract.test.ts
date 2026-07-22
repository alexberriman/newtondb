import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  Database,
  collectionSchema,
  localPredicate,
  parseWhere,
  queryGrammarVersion,
  queryJsonSchema,
  type LocalPredicate,
} from "../src/index.js";

type RecordDocument = { id: string; score: number };

describe("published query contract", () => {
  const ajv = new Ajv2020({ strict: true, strictTuples: false });
  const validate = ajv.compile(queryJsonSchema);

  it("publishes a valid, versioned JSON Schema", () => {
    expect(queryGrammarVersion).toBe(1);
    expect(ajv.validateSchema(queryJsonSchema)).toBe(true);
    expect(Object.isFrozen(queryJsonSchema)).toBe(true);
    expect(Object.isFrozen(queryJsonSchema.$defs.where.oneOf)).toBe(true);
  });

  it.each([
    { op: "eq", path: ["id"], value: "one" },
    { op: "in", path: ["score"], value: [1, 2, 3] },
    {
      conditions: [
        { op: "gte", path: ["score"], value: 10 },
        { condition: { op: "eq", path: ["id"], value: "blocked" }, op: "not" },
      ],
      op: "and",
    },
  ])(
    "accepts grammar example %# in both schema and runtime parser",
    (candidate) => {
      expect(validate(candidate), JSON.stringify(validate.errors)).toBe(true);
      expect(() => parseWhere(candidate)).not.toThrow();
    },
  );

  it.each([
    { extra: true, op: "eq", path: ["id"], value: "one" },
    { op: "startsWith", path: ["id"], value: 1 },
    { op: "eq", path: [0], value: "one" },
    { conditions: [], op: "or" },
  ])("rejects out-of-contract example %# consistently", (candidate) => {
    expect(validate(candidate)).toBe(false);
    expect(() => parseWhere(candidate)).toThrow();
  });

  it("brands local executable predicates separately from serializable ASTs", () => {
    const predicate = localPredicate<RecordDocument>(
      ({ score }) => score >= 10,
    );
    expectTypeOf(predicate).toEqualTypeOf<LocalPredicate<RecordDocument>>();
    const db = Database.memory(
      {
        records: [
          { id: "low", score: 1 },
          { id: "high", score: 10 },
        ] satisfies RecordDocument[],
      },
      {
        schema: {
          records: collectionSchema<RecordDocument>({ primaryKey: "id" }),
        },
      },
    );

    expect(db.collection("records").filter(predicate)).toEqual([
      { id: "high", score: 10 },
    ]);
    expect(JSON.stringify(predicate)).toBe("{}");
    expect(Object.isFrozen(predicate)).toBe(true);
  });
});
