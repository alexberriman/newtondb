import { describe, expect, it } from "vitest";

import {
  JsonValidationError,
  cloneAndFreezeJsonObject,
  type JsonObject,
} from "../src/index.js";

describe("JSON ownership boundary", () => {
  it("detaches and recursively freezes documents", () => {
    const input = { nested: { active: true }, tags: ["science"] };
    const result = cloneAndFreezeJsonObject(input);

    input.nested.active = false;
    input.tags.push("maths");

    expect(result).toEqual({ nested: { active: true }, tags: ["science"] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nested)).toBe(true);
    expect(Object.isFrozen(result.tags)).toBe(true);
  });

  it("stores prototype-like keys as inert own data", () => {
    const input = Object.create(null) as JsonObject;
    Object.defineProperty(input, "__proto__", {
      enumerable: true,
      value: { polluted: true },
    });

    const result = cloneAndFreezeJsonObject(input);

    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it("rejects an accessor without invoking it", () => {
    let invoked = false;
    const input = Object.create(null) as JsonObject;
    Object.defineProperty(input, "secret", {
      enumerable: true,
      get() {
        invoked = true;
        return "leaked";
      },
    });

    expect(() => cloneAndFreezeJsonObject(input)).toThrow(
      expect.objectContaining({
        issue: expect.objectContaining({ code: "ACCESSOR", path: ["secret"] }),
      }),
    );
    expect(invoked).toBe(false);
  });

  it.each([
    [
      "cycle",
      () => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return value;
      },
      "CYCLE",
    ],
    ["non-finite number", () => ({ value: Number.NaN }), "INVALID_NUMBER"],
    ["undefined", () => ({ value: undefined }), "UNSUPPORTED_VALUE"],
    [
      "custom prototype",
      () => Object.create({ inherited: true }) as JsonObject,
      "INVALID_PROTOTYPE",
    ],
    ["sparse array", () => ({ values: new Array(2) }), "SPARSE_ARRAY"],
  ])("rejects %s", (_name, makeValue, code) => {
    expect(() => cloneAndFreezeJsonObject(makeValue() as JsonObject)).toThrow(
      expect.objectContaining({ issue: expect.objectContaining({ code }) }),
    );
  });

  it("enforces depth, node, string, and document byte limits", () => {
    expect(() =>
      cloneAndFreezeJsonObject(
        { nested: { value: true } },
        {
          maxDepth: 1,
          maxDocumentBytes: 100,
          maxNodes: 10,
          maxStringBytes: 20,
        },
      ),
    ).toThrow(JsonValidationError);
    expect(() =>
      cloneAndFreezeJsonObject(
        { a: true, b: true },
        { maxDepth: 4, maxDocumentBytes: 100, maxNodes: 2, maxStringBytes: 20 },
      ),
    ).toThrow(
      expect.objectContaining({
        issue: expect.objectContaining({ code: "NODE_LIMIT" }),
      }),
    );
    expect(() =>
      cloneAndFreezeJsonObject(
        { value: "abcd" },
        { maxDepth: 4, maxDocumentBytes: 100, maxNodes: 10, maxStringBytes: 3 },
      ),
    ).toThrow(
      expect.objectContaining({
        issue: expect.objectContaining({ code: "STRING_SIZE_LIMIT" }),
      }),
    );
    expect(() =>
      cloneAndFreezeJsonObject(
        { value: "abcd" },
        { maxDepth: 4, maxDocumentBytes: 8, maxNodes: 10, maxStringBytes: 20 },
      ),
    ).toThrow(
      expect.objectContaining({
        issue: expect.objectContaining({ code: "DOCUMENT_SIZE_LIMIT" }),
      }),
    );
  });
});
