import {
  link,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { Database, collectionSchema } from "../src/index.js";
import { JsonFileAdapter } from "../src/node/index.js";

type User = { id: string; name: string };
type Seed = { users: User[] };

const schema = {
  users: collectionSchema<User>({ primaryKey: "id" }),
};
const directories: string[] = [];

async function temporaryPath(name = "database.json"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "newtondb-test-"));
  directories.push(directory);
  return join(directory, name);
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("JsonFileAdapter", () => {
  it("atomically persists, closes, and reopens a database", async () => {
    const path = await temporaryPath();
    const first = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [{ id: "u1", name: "Isaac" }] },
      schema,
    });
    await first.collection("users").insert({ id: "u2", name: "Albert" });
    const identity = first.id;
    await first.close();

    const file = JSON.parse(await readFile(path, "utf8")) as {
      checksum: string;
      snapshot: { generation: number; revision: number };
    };
    expect(file.checksum).toMatch(/^[a-f\d]{64}$/u);
    expect(file.snapshot).toMatchObject({ generation: 1, revision: 1 });
    expect((await stat(path)).mode & 0o777).toBe(0o600);

    const second = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      schema,
    });
    expect(second.id).toBe(identity);
    expect(second.collection("users").get("u2")?.name).toBe("Albert");
    await second.close();
  });

  it("excludes a second cooperative writer until close", async () => {
    const path = await temporaryPath();
    const first = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });

    await expect(
      Database.open<Seed>({
        adapter: new JsonFileAdapter<Seed>(path),
        initialData: { users: [] },
        schema,
      }),
    ).rejects.toMatchObject({ code: "ERR_STORAGE_CONFLICT" });

    await first.close();
    const next = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await next.close();
  });

  it("persists an empty initial database on close", async () => {
    const path = await temporaryPath();
    const first = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await first.close();

    const reopened = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      schema,
    });
    expect(reopened.collection("users").count).toBe(0);
    await reopened.close();
  });

  it("recovers an abandoned malformed lock conservatively", async () => {
    const path = await temporaryPath();
    await writeFile(`${path}.lock`, "abandoned", { mode: 0o600 });

    const db = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await db.close();
  });

  it("does not reclaim a lock whose pid may have been reused", async () => {
    const path = await temporaryPath();
    const lock = JSON.stringify({ pid: process.pid, token: "previous-owner" });
    await writeFile(`${path}.lock`, lock, { mode: 0o600 });

    await expect(
      Database.open<Seed>({
        adapter: new JsonFileAdapter<Seed>(path),
        initialData: { users: [] },
        schema,
      }),
    ).rejects.toMatchObject({ code: "ERR_STORAGE_CONFLICT" });
    await expect(readFile(`${path}.lock`, "utf8")).resolves.toBe(lock);
  });

  it("fails fenced writes and preserves a replacement lock", async () => {
    const path = await temporaryPath();
    const database = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await unlink(`${path}.lock`);
    const replacement = JSON.stringify({
      pid: process.pid,
      token: "replacement-owner",
    });
    await writeFile(`${path}.lock`, replacement, { mode: 0o600 });

    await expect(
      database.collection("users").insert({ id: "u1", name: "Isaac" }),
    ).rejects.toMatchObject({ code: "ERR_PERSISTENCE" });
    await expect(database.close()).rejects.toMatchObject({
      code: "ERR_PERSISTENCE",
    });
    await expect(readFile(`${path}.lock`, "utf8")).resolves.toBe(replacement);
  });

  it("rejects checksum corruption without exposing a database", async () => {
    const path = await temporaryPath();
    const first = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await first.collection("users").insert({ id: "u1", name: "Isaac" });
    await first.close();

    const file = JSON.parse(await readFile(path, "utf8")) as {
      checksum: string;
      snapshot: { revision: number };
    };
    file.snapshot.revision = 999;
    await writeFile(path, JSON.stringify(file), { mode: 0o600 });

    await expect(
      Database.open<Seed>({
        adapter: new JsonFileAdapter<Seed>(path),
        schema,
      }),
    ).rejects.toMatchObject({ code: "ERR_CORRUPT_STORAGE" });
  });

  it("rejects duplicate JSON keys before last-name-wins parsing", async () => {
    const path = await temporaryPath();
    await writeFile(
      path,
      '{"checksum":"first","checksum":"second","snapshot":{}}',
      { mode: 0o600 },
    );

    await expect(new JsonFileAdapter<Seed>(path).load()).rejects.toMatchObject({
      code: "ERR_CORRUPT_STORAGE",
      message: expect.stringContaining("duplicate object key"),
    });
  });

  it("rejects byte-order marks, oversized files, and symlinks", async () => {
    const bomPath = await temporaryPath("bom.json");
    await writeFile(bomPath, Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]));
    await expect(
      new JsonFileAdapter<Seed>(bomPath).load(),
    ).rejects.toMatchObject({ code: "ERR_CORRUPT_STORAGE" });

    const largePath = join(join(bomPath, ".."), "large.json");
    await writeFile(largePath, "12345");
    await expect(
      new JsonFileAdapter<Seed>(largePath, { maxBytes: 4 }).load(),
    ).rejects.toMatchObject({ code: "ERR_CORRUPT_STORAGE" });

    const targetPath = join(join(bomPath, ".."), "target.json");
    const linkPath = join(join(bomPath, ".."), "link.json");
    await writeFile(targetPath, "{}");
    await symlink(targetPath, linkPath);
    await expect(
      new JsonFileAdapter<Seed>(linkPath).load(),
    ).rejects.toMatchObject({ code: "ERR_CORRUPT_STORAGE" });
  });

  it("creates an explicitly requested parent directory", async () => {
    const path = await temporaryPath("nested/database.json");
    const db = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path, { createDirectories: true }),
      initialData: { users: [] },
      schema,
    });
    await db.collection("users").insert({ id: "u1", name: "Isaac" });
    await db.close();
    await expect(stat(path)).resolves.toMatchObject({
      size: expect.any(Number),
    });
  });

  it("creates a verified previous-snapshot backup and requires explicit recovery", async () => {
    const path = await temporaryPath();
    const first = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await first.collection("users").insert({ id: "u1", name: "Isaac" });
    await first.collection("users").insert({ id: "u2", name: "Albert" });
    await first.close();
    await expect(stat(`${path}.backup`)).resolves.toMatchObject({
      size: expect.any(Number),
    });
    await writeFile(path, "corrupt", { mode: 0o600 });

    await expect(
      Database.open<Seed>({ adapter: new JsonFileAdapter<Seed>(path), schema }),
    ).rejects.toMatchObject({ code: "ERR_CORRUPT_STORAGE" });

    const recovered = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path, { recoverFromBackup: true }),
      schema,
    });
    expect(recovered.collection("users").toArray()).toEqual([
      { id: "u1", name: "Isaac" },
    ]);
    await recovered.close();

    const verified = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      schema,
    });
    expect(verified.collection("users").has("u1")).toBe(true);
    await verified.close();
  });

  it("fails closed when both primary and backup are corrupt", async () => {
    const path = await temporaryPath();
    const first = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await first.collection("users").insert({ id: "u1", name: "Isaac" });
    await first.collection("users").insert({ id: "u2", name: "Albert" });
    await first.close();
    await writeFile(path, "corrupt primary");
    await writeFile(`${path}.backup`, "corrupt backup");

    await expect(
      Database.open<Seed>({
        adapter: new JsonFileAdapter<Seed>(path, { recoverFromBackup: true }),
        schema,
      }),
    ).rejects.toMatchObject({ code: "ERR_CORRUPT_STORAGE" });
  });

  it("rejects a hard-linked primary snapshot", async () => {
    const path = await temporaryPath();
    const first = await Database.open<Seed>({
      adapter: new JsonFileAdapter<Seed>(path),
      initialData: { users: [] },
      schema,
    });
    await first.close();
    const alias = `${path}.alias`;
    await link(path, alias);

    await expect(
      Database.open<Seed>({ adapter: new JsonFileAdapter<Seed>(path), schema }),
    ).rejects.toMatchObject({ code: "ERR_CORRUPT_STORAGE" });
    await unlink(alias);
  });
});
