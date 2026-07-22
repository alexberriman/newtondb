import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  Database,
  collectionSchema,
  snapshotMaximumReadableVersion,
  snapshotMinimumReadableVersion,
  type SnapshotEnvelope,
  type StorageAdapter,
} from "../src/index.js";

type User = { id: string; name: string };
type Seed = { users: User[] };

class FixtureAdapter implements StorageAdapter<Seed> {
  closed = false;
  constructor(private readonly fixture: unknown) {}
  async close(): Promise<void> {
    this.closed = true;
  }
  async load(): Promise<SnapshotEnvelope<Seed> | null> {
    return this.fixture as SnapshotEnvelope<Seed>;
  }
  async store(): Promise<never> {
    throw new Error("fixture adapter is read-only");
  }
}

async function fixture(version: 0 | 1 | 2): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL(`fixtures/storage/format-${version}.json`, import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

const schema = {
  users: collectionSchema<User>({ primaryKey: "id" }),
};

describe("snapshot format evolution", () => {
  it("declares an exact current reader window", () => {
    expect(snapshotMinimumReadableVersion).toBe(1);
    expect(snapshotMaximumReadableVersion).toBe(1);
  });

  it("accepts the current fixture and ignores unknown envelope metadata", async () => {
    const adapter = new FixtureAdapter(await fixture(1));
    const db = await Database.open<Seed>({ adapter, schema });
    expect(db.collection("users").get("u1")?.name).toBe("current");
    await db.close();
  });

  it.each([0, 2] as const)(
    "fails closed for unsupported format fixture %i",
    async (version) => {
      const adapter = new FixtureAdapter(await fixture(version));
      await expect(
        Database.open<Seed>({ adapter, schema }),
      ).rejects.toMatchObject({
        code: "ERR_CORRUPT_STORAGE",
      });
      expect(adapter.closed).toBe(true);
    },
  );

  it("fails closed for a structurally malformed custom-adapter value", async () => {
    const adapter = new FixtureAdapter({
      format: "newtondb",
      formatVersion: 1,
    });
    await expect(
      Database.open<Seed>({ adapter, schema }),
    ).rejects.toMatchObject({
      code: "ERR_CORRUPT_STORAGE",
    });
    expect(adapter.closed).toBe(true);
  });
});
