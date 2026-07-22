import process from "node:process";

import { Database, collectionSchema } from "../dist/index.js";
import { JsonFileAdapter } from "../dist/node/index.js";

const [path] = process.argv.slice(2);
if (path === undefined) throw new Error("Lock child requires a database path");
const schema = { records: collectionSchema({ primaryKey: "id" }) };
const database = await Database.open({
  adapter: new JsonFileAdapter(path),
  schema,
});
process.stdout.write("READY\n");
await new Promise((resolve) => process.stdin.once("data", resolve));
await database.close();
