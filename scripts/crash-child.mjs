import process from "node:process";

import { Database, collectionSchema } from "../dist/index.js";
import { JsonFileAdapter } from "../dist/node/index.js";

const [path, target] = process.argv.slice(2);
if (path === undefined || target === undefined) {
  throw new Error("Crash child requires a database path and fault point");
}

const schema = { records: collectionSchema({ primaryKey: "id" }) };
const adapter = new JsonFileAdapter(path, {
  faultInjector(point) {
    if (point === target) process.exit(86);
  },
});
const database = await Database.open({ adapter, schema });
await database.collection("records").insert({ id: "new", value: 2 });
throw new Error(`Fault point ${target} was not reached`);
