import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatPath, parsePath, readPath, validatePath } from "../src/index.js";

describe("typed property paths", () => {
  it("losslessly round-trips string and numeric tokens", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ maxLength: 30 }),
          fc.array(
            fc.oneof(
              fc.string({ maxLength: 30 }),
              fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
            ),
            { maxLength: 19 },
          ),
        ),
        ([first, rest]) => {
          const tokens = [first, ...rest];
          const path = validatePath(tokens);
          expect(parsePath(formatPath(path))).toEqual(path);
        },
      ),
      { numRuns: 1_000 },
    );
  });

  it("escapes slashes, tildes, and numeric-looking string keys", () => {
    const path = validatePath(["a/b", "~n12", 12, "0"]);
    expect(formatPath(path)).toBe("/a~1b/~0n12/~n12/0");
    expect(parsePath("/a~1b/~0n12/~n12/0")).toEqual(path);
  });

  it("rejects malformed or unsafe pointers deterministically", () => {
    expect(() => parsePath("")).toThrow(/start with/u);
    expect(() => parsePath("/~2")).toThrow(/invalid escape/u);
    expect(() => parsePath("/~n9007199254740992")).toThrow(/safe-integer/u);
    expect(() => parsePath("/one/two", 1)).toThrow(/1-1 tokens/u);
  });

  it("reads only own data properties, including prototype-like names", () => {
    const inherited = Object.create({ secret: "inherited" }) as Record<
      string,
      unknown
    >;
    Object.defineProperty(inherited, "__proto__", {
      enumerable: true,
      value: "stored",
    });
    Object.defineProperties(inherited, {
      constructor: { enumerable: true, value: "constructor-value" },
      explosive: {
        enumerable: true,
        get() {
          throw new Error("getter executed");
        },
      },
    });

    expect(readPath(inherited, ["__proto__"])).toBe("stored");
    expect(readPath(inherited, ["constructor"])).toBe("constructor-value");
    expect(readPath(inherited, ["secret"])).toBeUndefined();
    expect(readPath(inherited, ["explosive"])).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, "secret")).toBe(false);
  });

  it("distinguishes array positions from object properties", () => {
    expect(readPath({ values: ["zero"] }, ["values", 0])).toBe("zero");
    expect(
      readPath({ values: { "0": "property" } }, ["values", 0]),
    ).toBeUndefined();
    expect(readPath({ values: { "0": "property" } }, ["values", "0"])).toBe(
      "property",
    );
  });
});
