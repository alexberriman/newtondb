import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

import { Database, collectionSchema } from "../dist/index.js";
import { JsonFileAdapter } from "../dist/node/index.js";

const points = [
  "before-temp-open",
  "after-temp-open",
  "after-write",
  "after-file-sync",
  "after-temp-close",
  "after-rename",
  "after-directory-sync",
];
const schema = { records: collectionSchema({ primaryKey: "id" }) };
const directory = await mkdtemp(join(tmpdir(), "newtondb-crash-"));

try {
  for (const point of points) {
    const path = join(directory, `${point}.json`);
    const initial = await Database.open({
      adapter: new JsonFileAdapter(path),
      initialData: { records: [{ id: "old", value: 1 }] },
      schema,
    });
    await initial.flush();
    await initial.close();

    const crashed = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("crash-child.mjs", import.meta.url)), path, point],
      { encoding: "utf8" },
    );
    if (crashed.status !== 86) {
      throw new Error(
        `Crash at ${point} exited ${crashed.status}: ${crashed.stderr || crashed.stdout}`,
      );
    }

    const recovered = await Database.open({
      adapter: new JsonFileAdapter(path),
      schema,
    });
    const ids = recovered
      .collection("records")
      .toArray()
      .map(({ id }) => id);
    const oldOrNew =
      JSON.stringify(ids) === JSON.stringify(["old"]) ||
      JSON.stringify(ids) === JSON.stringify(["old", "new"]);
    if (!oldOrNew) {
      throw new Error(
        `Crash at ${point} recovered an invalid state: ${ids.join(",")}`,
      );
    }
    await recovered.close();
  }
  process.stdout.write(`Validated ${points.length} crash boundaries\n`);
} finally {
  await rm(directory, { force: true, recursive: true });
}
