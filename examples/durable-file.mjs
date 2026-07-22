import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Database, collectionSchema } from "newtondb";
import { JsonFileAdapter } from "newtondb/node";

const directory = await mkdtemp(join(tmpdir(), "newtondb-example-"));
const path = join(directory, "database.json");
const schema = { records: collectionSchema({ primaryKey: "id" }) };
try {
  const database = await Database.open({
    adapter: new JsonFileAdapter(path),
    initialData: { records: [] },
    schema,
  });
  const receipt = await database
    .collection("records")
    .insert({ id: "one", value: 1 });
  if (receipt.durability !== "persisted")
    throw new Error("durability mismatch");
  await database.close();

  const reopened = await Database.open({
    adapter: new JsonFileAdapter(path),
    schema,
  });
  if (reopened.collection("records").get("one")?.value !== 1) {
    throw new Error("durable reopen failed");
  }
  await reopened.close();
} finally {
  await rm(directory, { force: true, recursive: true });
}
