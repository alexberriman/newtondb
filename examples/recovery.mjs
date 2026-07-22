import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Database, collectionSchema } from "newtondb";
import { JsonFileAdapter } from "newtondb/node";

const directory = await mkdtemp(join(tmpdir(), "newtondb-recovery-"));
const path = join(directory, "database.json");
const schema = { records: collectionSchema({ primaryKey: "id" }) };
try {
  const database = await Database.open({
    adapter: new JsonFileAdapter(path),
    initialData: { records: [] },
    schema,
  });
  await database.collection("records").insert({ id: "verified", value: 1 });
  await database.collection("records").insert({ id: "newer", value: 2 });
  await database.close();
  await writeFile(path, "corrupt primary", { mode: 0o600 });

  const recovered = await Database.open({
    adapter: new JsonFileAdapter(path, { recoverFromBackup: true }),
    schema,
  });
  if (!recovered.collection("records").has("verified")) {
    throw new Error("verified backup recovery failed");
  }
  await recovered.close();
} finally {
  await rm(directory, { force: true, recursive: true });
}
