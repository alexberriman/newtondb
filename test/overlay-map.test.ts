import { describe, expect, it } from "vitest";

import { OverlayMap } from "../src/overlay-map.js";

describe("copy-on-write overlay map", () => {
  it("publishes small deltas without copying the base map", () => {
    const base = new Map(
      Array.from({ length: 10_000 }, (_, index) => [`key-${index}`, index]),
    );
    const overlay = new OverlayMap(base);
    overlay.set("key-5000", -1);
    overlay.delete("key-10");
    overlay.set("new", 10_001);
    const committed = overlay.seal();

    expect(committed).toBe(overlay);
    expect(overlay.changedCount).toBe(3);
    expect(base.get("key-5000")).toBe(5_000);
    expect(base.has("key-10")).toBe(true);
    expect([...committed].at(-1)).toEqual(["new", 10_001]);
    expect(() => overlay.set("late", 1)).toThrow(/immutable/u);
  });

  it("compacts at a bounded layer depth", () => {
    let committed: ReadonlyMap<string, number> = new Map([["key", 0]]);
    let compactions = 0;
    for (let revision = 1; revision <= 100; revision += 1) {
      const overlay = new OverlayMap(committed);
      overlay.set("key", revision);
      committed = overlay.seal();
      if (committed instanceof Map) compactions += 1;
      expect(committed.get("key")).toBe(revision);
    }
    expect(compactions).toBe(3);
    expect(committed.size).toBe(1);
  });

  it("compacts a large delta instead of retaining a costly overlay", () => {
    const base = new Map(
      Array.from({ length: 2_000 }, (_, index) => [`key-${index}`, index]),
    );
    const overlay = new OverlayMap(base);
    for (let index = 0; index < 500; index += 1) {
      overlay.set(`key-${index}`, -index);
    }
    expect(overlay.seal()).toBeInstanceOf(Map);
  });
});
