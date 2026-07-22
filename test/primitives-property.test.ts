import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  cloneAndFreezeJsonObject,
  type JsonObject,
  type JsonValue,
} from "../src/index.js";
import { encodeIndexValue, encodeKey } from "../src/key.js";

function expectDeepFrozen(value: JsonValue): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) expectDeepFrozen(child);
  }
}

describe("primitive property corpora", () => {
  it("clones arbitrary JSON object trees without aliases", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ maxLength: 30 }),
          fc.jsonValue({ maxDepth: 8 }),
        ),
        (input) => {
          const cloned = cloneAndFreezeJsonObject(input as JsonObject);
          expect(cloned).toEqual(input);
          expect(cloned).not.toBe(input);
          expect(Object.getPrototypeOf(cloned)).toBeNull();
          expectDeepFrozen(cloned);
        },
      ),
      { numRuns: 1_000, seed: 20_260_725 },
    );
  });

  it("rejects symbols, bigint, functions, nested cycles, and hostile descriptors", () => {
    const symbolProperty = { value: true } as Record<PropertyKey, unknown>;
    symbolProperty[Symbol("hidden")] = "secret";
    const nestedCycle: Record<string, unknown> = { child: {} };
    (nestedCycle.child as Record<string, unknown>).parent = nestedCycle;
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    for (const candidate of [
      symbolProperty,
      { value: 1n },
      { value: () => true },
      nestedCycle,
      revoked.proxy,
    ]) {
      expect(() => cloneAndFreezeJsonObject(candidate)).toThrow();
    }
  });

  it("keeps the primary-key codec injective over its declared domain", () => {
    const key = fc.oneof(
      fc.string({ maxLength: 100 }).filter((value) => value.length > 0),
      fc.integer({
        min: Number.MIN_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER,
      }),
    );
    fc.assert(
      fc.property(key, key, (left, right) => {
        expect(encodeKey(left) === encodeKey(right)).toBe(left === right);
      }),
      { numRuns: 10_000, seed: 20_260_726 },
    );
    const edges = [
      "0",
      "n:0",
      "💡",
      "a:b",
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ].map(encodeKey);
    expect(new Set(edges).size).toBe(edges.length);
  });

  it("matches index encoding identity to strict primitive equality", () => {
    const primitive = fc.oneof(
      fc.boolean(),
      fc.constant(null),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.string({ maxLength: 100 }),
    );
    fc.assert(
      fc.property(primitive, primitive, (left, right) => {
        expect(encodeIndexValue(left) === encodeIndexValue(right)).toBe(
          left === right,
        );
      }),
      { numRuns: 10_000, seed: 20_260_727 },
    );
    expect(encodeIndexValue(-0)).toBe(encodeIndexValue(0));
  });
});
