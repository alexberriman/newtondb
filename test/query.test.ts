import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  Database,
  DuplicateUniqueIndexError,
  QueryValidationError,
  collectionSchema,
  compileWhere,
  parseWhere,
  where,
  type Where,
} from "../src/index.js";

type User = {
  active: boolean;
  age: number;
  email: string;
  id: string;
  name: string;
};

type Probe = {
  flag: boolean;
  id: string;
  number: number;
  text: string;
  value: null | number | string;
};

function independentlyEvaluate(
  condition: Where<Probe>,
  document: Probe,
): boolean {
  if (condition.op === "and") {
    return condition.conditions.every((child) =>
      independentlyEvaluate(child, document),
    );
  }
  if (condition.op === "or") {
    return condition.conditions.some((child) =>
      independentlyEvaluate(child, document),
    );
  }
  if (condition.op === "not")
    return !independentlyEvaluate(condition.condition, document);
  const source = document[condition.path[0] as keyof Probe];
  const value = condition.value;
  switch (condition.op) {
    case "eq":
      return source === value;
    case "ne":
      return source !== value;
    case "in":
      return (value as readonly unknown[]).some(
        (candidate) => candidate === source,
      );
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (
        (typeof source !== "number" && typeof source !== "string") ||
        typeof source !== typeof value
      )
        return false;
      const comparable = value as number | string;
      if (condition.op === "gt") return source > comparable;
      if (condition.op === "gte") return source >= comparable;
      if (condition.op === "lt") return source < comparable;
      return source <= comparable;
    }
    case "contains":
      return typeof source === "string" && source.includes(String(value));
    case "startsWith":
      return typeof source === "string" && source.startsWith(String(value));
    case "endsWith":
      return typeof source === "string" && source.endsWith(String(value));
  }
}

const users: User[] = [
  {
    active: true,
    age: 84,
    email: "isaac@example.com",
    id: "u1",
    name: "Isaac",
  },
  {
    active: false,
    age: 76,
    email: "albert@example.com",
    id: "u2",
    name: "Albert",
  },
  {
    active: true,
    age: 88,
    email: "galileo@example.com",
    id: "u3",
    name: "Galileo",
  },
];

function createIndexedDatabase(seed = users) {
  return Database.memory(
    { users: seed },
    {
      schema: {
        users: collectionSchema<User>({
          indexes: [
            { name: "by-active", path: ["active"] },
            { name: "by-email", path: ["email"], unique: true },
          ],
          primaryKey: "id",
        }),
      },
    },
  );
}

describe("serializable query grammar", () => {
  it("builds schema-derived conditions", () => {
    const w = where<User>();
    const condition = w.and(
      w.eq("active", true),
      w.gte("age", 80),
      w.not(w.eq("name", "Albert")),
    );

    expectTypeOf(condition).toExtend<Where<User>>();
    expect(condition).toEqual({
      conditions: [
        { op: "eq", path: ["active"], value: true },
        { op: "gte", path: ["age"], value: 80 },
        { condition: { op: "eq", path: ["name"], value: "Albert" }, op: "not" },
      ],
      op: "and",
    });
    expect(Object.isFrozen(condition)).toBe(true);
  });

  it("validates untrusted ASTs without invoking accessors", () => {
    let invoked = false;
    const candidate = { op: "eq", path: ["name"] } as Record<string, unknown>;
    Object.defineProperty(candidate, "value", {
      enumerable: true,
      get() {
        invoked = true;
        return "Isaac";
      },
    });

    expect(() => parseWhere(candidate)).toThrow(QueryValidationError);
    expect(invoked).toBe(false);
  });

  it.each([
    [{ op: "regex", path: ["name"], value: ".*" }, "INVALID_OPERATOR"],
    [{ op: "and", conditions: [] }, "INVALID_BOOLEAN"],
    [{ op: "eq", path: [], value: "x" }, "INVALID_PATH"],
    [{ op: "eq", path: ["x"], value: Number.NaN }, "INVALID_VALUE"],
    [{ op: "in", path: ["x"], value: [undefined] }, "INVALID_VALUE"],
  ])("rejects malformed condition %#", (condition, issue) => {
    expect(() => parseWhere(condition)).toThrow(
      expect.objectContaining({ code: "ERR_QUERY_VALIDATION", issue }),
    );
  });

  it("enforces query depth and node limits", () => {
    const condition = {
      condition: {
        condition: { op: "eq", path: ["id"], value: "u1" },
        op: "not",
      },
      op: "not",
    };
    expect(() =>
      parseWhere(condition, {
        maxDepth: 1,
        maxNodes: 10,
        maxPathTokens: 4,
        maxScalarBytes: 20,
        maxSetValues: 4,
        maxTotalScalarBytes: 100,
      }),
    ).toThrow(expect.objectContaining({ issue: "DEPTH_LIMIT" }));
    expect(() =>
      parseWhere(
        { conditions: [{ op: "eq", path: ["id"], value: "u1" }], op: "and" },
        {
          maxDepth: 4,
          maxNodes: 1,
          maxPathTokens: 4,
          maxScalarBytes: 20,
          maxSetValues: 4,
          maxTotalScalarBytes: 100,
        },
      ),
    ).toThrow(expect.objectContaining({ issue: "NODE_LIMIT" }));
    expect(() =>
      parseWhere(
        { op: "eq", path: ["value"], value: "x".repeat(21) },
        {
          maxDepth: 4,
          maxNodes: 4,
          maxPathTokens: 4,
          maxScalarBytes: 20,
          maxSetValues: 4,
          maxTotalScalarBytes: 100,
        },
      ),
    ).toThrow(expect.objectContaining({ issue: "SCALAR_SIZE_LIMIT" }));
  });

  it("defines strict, non-coercing comparison truth tables", () => {
    const stringNumber = compileWhere({
      op: "eq",
      path: ["value"],
      value: "1",
    });
    const missingNotEqual = compileWhere({
      op: "ne",
      path: ["missing"],
      value: null,
    });
    const mixedOrder = compileWhere({ op: "gt", path: ["value"], value: 0 });

    expect(stringNumber.test({ value: 1 })).toBe(false);
    expect(stringNumber.test({ value: "1" })).toBe(true);
    expect(missingNotEqual.test({ value: null })).toBe(true);
    expect(mixedOrder.test({ value: "10" })).toBe(false);
    expect(
      compileWhere({ op: "contains", path: ["value"], value: 1 }).test({
        value: "123",
      }),
    ).toBe(false);
  });

  it("matches an independently implemented evaluator over generated ASTs", () => {
    const primitive = fc.oneof(fc.integer(), fc.string(), fc.constant(null));
    const base = fc.oneof(
      fc.record({
        op: fc.constantFrom("eq" as const, "ne" as const),
        path: fc.constant(["value"] as const),
        value: primitive,
      }),
      fc.record({
        op: fc.constantFrom(
          "gt" as const,
          "gte" as const,
          "lt" as const,
          "lte" as const,
        ),
        path: fc.constant(["number"] as const),
        value: fc.integer(),
      }),
      fc.record({
        op: fc.constantFrom(
          "contains" as const,
          "startsWith" as const,
          "endsWith" as const,
        ),
        path: fc.constant(["text"] as const),
        value: fc.string(),
      }),
      fc.record({
        op: fc.constant("in" as const),
        path: fc.constant(["value"] as const),
        value: fc.array(primitive, { maxLength: 8 }),
      }),
    );
    const condition = fc.oneof(
      base,
      base.map((child) => ({ condition: child, op: "not" as const })),
      fc
        .array(base, { minLength: 1, maxLength: 5 })
        .chain((conditions) =>
          fc.constantFrom(
            { conditions, op: "and" as const },
            { conditions, op: "or" as const },
          ),
        ),
    );
    const document = fc.record({
      flag: fc.boolean(),
      id: fc.uuid(),
      number: fc.integer(),
      text: fc.string(),
      value: primitive,
    });

    fc.assert(
      fc.property(condition, document, (candidate, probe) => {
        const ast = candidate as Where<Probe>;
        expect(compileWhere<Probe>(ast).test(probe)).toBe(
          independentlyEvaluate(ast, probe),
        );
      }),
      { numRuns: 2_000, seed: 20_260_724 },
    );
  });
});

describe("query planning and secondary indexes", () => {
  it("bounds broad query candidates and order fields", () => {
    type Row = { id: number; value: number };
    const rows = Array.from({ length: 100_001 }, (_, id) => ({
      id,
      value: id,
    }));
    const database = Database.memory(
      { rows },
      { schema: { rows: collectionSchema<Row>({ primaryKey: "id" }) } },
    );
    const broad = where<Row>().gte("value", 0);

    expect(() => database.collection("rows").findMany(broad)).toThrow(
      expect.objectContaining({ issue: "CANDIDATE_LIMIT" }),
    );
    const transaction = database.beginTransaction();
    expect(() => transaction.collection("rows").find(broad)).toThrow(
      expect.objectContaining({ issue: "CANDIDATE_LIMIT" }),
    );
    let ordered = database.collection("rows").query(broad).orderBy("value");
    for (let index = 1; index < 8; index += 1)
      ordered = ordered.thenBy("value");
    expect(() => ordered.thenBy("value")).toThrow(/at most 8 fields/u);
  });

  it("selects primary, secondary, and scan plans", () => {
    const db = createIndexedDatabase();
    const w = where<User>();

    expect(db.collection("users").query(w.eq("id", "u1")).explain()).toEqual({
      strategy: "primary",
    });
    expect(
      db.collection("users").query(w.eq("active", true)).explain(),
    ).toEqual({
      index: "by-active",
      strategy: "secondary",
    });
    expect(
      db.collection("users").query(w.startsWith("name", "I")).explain(),
    ).toEqual({
      strategy: "scan",
    });
  });

  it("executes boolean queries, deterministic order, offset, and limit", () => {
    const db = createIndexedDatabase();
    const w = where<User>();

    const result = db
      .collection("users")
      .query(w.or(w.eq("active", true), w.lt("age", 80)))
      .orderBy("age", "desc")
      .offset(1)
      .limit(2)
      .toArray();

    expect(result.map(({ id }) => id)).toEqual(["u1", "u2"]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("orders deterministically by multiple fields with primary-key tie-breaking", () => {
    const db = createIndexedDatabase();
    const query = db
      .collection("users")
      .query(where<User>().gte("age", 0))
      .orderBy("active", "desc")
      .thenBy("age", "asc");
    expect(query.toArray().map(({ id }) => id)).toEqual(["u1", "u3", "u2"]);
    expect(() =>
      db.collection("users").query(where<User>().gte("age", 0)).thenBy("age"),
    ).toThrow(/requires orderBy/u);
  });

  it("orders mixed JSON values with explicit null and missing placement", () => {
    type ValueDocument = {
      id: string;
      value?: boolean | null | number | string;
    };
    const db = Database.memory(
      {
        values: [
          { id: "missing" },
          { id: "null", value: null },
          { id: "string", value: "x" },
          { id: "number", value: 2 },
          { id: "boolean", value: false },
        ] satisfies ValueDocument[],
      },
      {
        schema: {
          values: collectionSchema<ValueDocument>({ primaryKey: "id" }),
        },
      },
    );
    expect(
      db
        .collection("values")
        .query({ op: "ne", path: ["id"], value: "absent" })
        .orderBy("value")
        .toArray()
        .map(({ id }) => id),
    ).toEqual(["boolean", "number", "string", "null", "missing"]);
  });

  it("maintains secondary indexes across updates, inserts, and deletes", async () => {
    const db = createIndexedDatabase();
    const w = where<User>();

    await db.transaction((tx) => {
      tx.collection("users").update("u1", { active: false });
      tx.collection("users").insert({
        active: true,
        age: 66,
        email: "marie@example.com",
        id: "u4",
        name: "Marie",
      });
      tx.collection("users").delete("u3");
    });

    expect(
      db
        .collection("users")
        .query(w.eq("active", true))
        .toArray()
        .map(({ id }) => id),
    ).toEqual(["u4"]);
  });

  it("preserves insertion order when an indexed bucket is read directly", async () => {
    const db = createIndexedDatabase();
    const users = db.collection("users");
    const active = where<User>().eq("active", true);

    expect(users.findMany(active).map(({ id }) => id)).toEqual(["u1", "u3"]);

    await users.delete("u1");
    await users.insert({
      active: true,
      age: 43,
      email: "isaac-again@example.com",
      id: "u1",
      name: "Isaac again",
    });

    expect(users.findMany(active).map(({ id }) => id)).toEqual(["u3", "u1"]);
  });

  it("enforces unique secondary indexes without partial updates", async () => {
    const db = createIndexedDatabase();

    await expect(
      db.collection("users").update("u1", { email: "albert@example.com" }),
    ).rejects.toBeInstanceOf(DuplicateUniqueIndexError);

    expect(db.collection("users").get("u1")?.email).toBe("isaac@example.com");
    expect(db.revision).toBe(0);
  });

  it("matches scan and index execution over generated datasets", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            active: fc.boolean(),
            age: fc.integer({ min: 0, max: 120 }),
            email: fc.uuid().map((id) => `${id}@example.com`),
            id: fc.uuid(),
            name: fc.string({ maxLength: 30 }),
          }),
          { maxLength: 100, selector: ({ id }) => id },
        ),
        fc.boolean(),
        (seed, active) => {
          const indexed = createIndexedDatabase(seed);
          const scanned = Database.memory(
            { users: seed },
            { schema: { users: collectionSchema<User>({ primaryKey: "id" }) } },
          );
          const condition = where<User>().eq("active", active);

          expect(
            indexed.collection("users").query(condition).toArray(),
          ).toEqual(scanned.collection("users").query(condition).toArray());
        },
      ),
      { numRuns: 100, seed: 20_260_723 },
    );
  });

  it("keeps indexed equality equivalent for negative and positive zero", () => {
    type Measurement = { id: string; value: number };
    const db = Database.memory(
      {
        measurements: [
          { id: "negative", value: -0 },
          { id: "positive", value: 0 },
        ] satisfies Measurement[],
      },
      {
        schema: {
          measurements: collectionSchema<Measurement>({
            indexes: [{ name: "by-value", path: ["value"] }],
            primaryKey: "id",
          }),
        },
      },
    );
    expect(
      db
        .collection("measurements")
        .findMany(where<Measurement>().eq("value", -0))
        .map(({ id }) => id),
    ).toEqual(["negative", "positive"]);
  });
});
