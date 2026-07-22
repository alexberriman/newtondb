import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const selectTag = (version: string) =>
  spawnSync(
    process.execPath,
    [resolve("scripts/release-dist-tag.mjs"), version],
    {
      encoding: "utf8",
    },
  );

describe("release dist-tag selection", () => {
  it.each([
    ["2.0.0", "latest"],
    ["2.0.0-beta.0", "beta"],
    ["2.0.0-BETA.7", "beta"],
    ["2.0.0-rc.1", "rc"],
    ["2.0.0-alpha.2", "next"],
  ])("maps %s to %s", (version, expected) => {
    const result = selectTag(version);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });

  it.each(["2", "x2.0.0", "2.0", "2.0.0-"])(
    'rejects malformed version "%s"',
    (version) => {
      const result = selectTag(version);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Invalid semantic version");
    },
  );
});
