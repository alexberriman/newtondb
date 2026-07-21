import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const workspace = await mkdtemp(join(tmpdir(), "newtondb-package-"));
let tarball;
try {
  const packed = spawnSync("npm", ["pack", "--json"], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  if (packed.status !== 0) throw new Error(packed.stderr || "npm pack failed");
  const filename = JSON.parse(packed.stdout)[0]?.filename;
  if (typeof filename !== "string")
    throw new Error("npm pack returned no filename");
  tarball = resolve(filename);
  await writeFile(
    join(workspace, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  const installed = spawnSync("npm", ["install", "--ignore-scripts", tarball], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (installed.status !== 0) {
    throw new Error(installed.stderr || "packed install failed");
  }
  await writeFile(
    join(workspace, "smoke.mjs"),
    `import { Database, collectionSchema } from "newtondb";
import { JsonFileAdapter } from "newtondb/node";
const schema = { records: collectionSchema({ primaryKey: "id" }) };
const db = Database.memory({ records: [{ id: "one" }] }, { schema });
if (!db.collection("records").has("one")) throw new Error("root import failed");
if (typeof JsonFileAdapter !== "function") throw new Error("node import failed");
`,
  );
  const smoke = spawnSync(process.execPath, [join(workspace, "smoke.mjs")], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (smoke.status !== 0)
    throw new Error(smoke.stderr || "package smoke failed");
  await readFile(join(workspace, "node_modules/newtondb/package.json"), "utf8");
} finally {
  await rm(workspace, { force: true, recursive: true });
  if (tarball !== undefined) await rm(tarball, { force: true });
}
