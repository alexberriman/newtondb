import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const workspace = await mkdtemp(join(tmpdir(), "newtondb-package-"));
const expectedVersion = JSON.parse(
  await readFile("package.json", "utf8"),
).version;
let tarball =
  process.argv[2] === undefined ? undefined : resolve(process.argv[2]);
let ownsTarball = false;
try {
  if (tarball === undefined) {
    const packed = spawnSync("npm", ["pack", "--json"], {
      cwd: resolve("."),
      encoding: "utf8",
    });
    if (packed.status !== 0)
      throw new Error(packed.stderr || "npm pack failed");
    const filename = JSON.parse(packed.stdout)[0]?.filename;
    if (typeof filename !== "string")
      throw new Error("npm pack returned no file");
    tarball = resolve(filename);
    ownsTarball = true;
  }

  const listed = spawnSync("tar", ["-tf", tarball], { encoding: "utf8" });
  if (listed.status !== 0)
    throw new Error(listed.stderr || "tar listing failed");
  const files = listed.stdout.trim().split("\n");
  const required = [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
    "package/static/newton.svg",
    "package/dist/manifest.json",
  ];
  for (const path of required) {
    if (!files.includes(path)) throw new Error(`packed artifact omits ${path}`);
  }
  const unexpected = files.filter(
    (path) =>
      !path.startsWith("package/dist/") && !required.slice(0, 4).includes(path),
  );
  if (unexpected.length > 0) {
    throw new Error(`unexpected packed paths: ${unexpected.join(", ")}`);
  }

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
import { MemoryStorageAdapter } from "newtondb/testing";
const schema = { records: collectionSchema({ primaryKey: "id" }) };
const memory = Database.memory({ records: [{ id: "one" }] }, { schema });
if (!memory.collection("records").has("one")) throw new Error("root import failed");
if (typeof MemoryStorageAdapter !== "function") throw new Error("testing import failed");
const path = new URL("database.json", import.meta.url).pathname;
const durable = await Database.open({ adapter: new JsonFileAdapter(path), initialData: { records: [] }, schema });
await durable.collection("records").insert({ id: "persisted", value: true });
await durable.close();
const reopened = await Database.open({ adapter: new JsonFileAdapter(path), schema });
if (!reopened.collection("records").has("persisted")) throw new Error("restart failed");
await reopened.close();
`,
  );
  await writeFile(
    join(workspace, "smoke.ts"),
    `import { Database, collectionSchema, where, type ReadonlyDeep } from "newtondb";
import { JsonFileAdapter } from "newtondb/node";
import { MemoryStorageAdapter } from "newtondb/testing";
type Row = { id: string; score: number };
const schema = { rows: collectionSchema<Row>({ primaryKey: "id" }) };
const db = Database.memory({ rows: [{ id: "one", score: 1 }] as Row[] }, { schema });
const row: ReadonlyDeep<Row> | undefined = db.collection("rows").get("one");
db.collection("rows").findMany(where<Row>().gte("score", 1));
void row; void JsonFileAdapter; void MemoryStorageAdapter;
`,
  );
  await writeFile(
    join(workspace, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        exactOptionalPropertyTypes: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        strict: true,
        target: "ES2022",
      },
      files: ["smoke.ts"],
    }),
  );
  const typed = spawnSync(
    process.execPath,
    [resolve("node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    { cwd: workspace, encoding: "utf8" },
  );
  if (typed.status !== 0) throw new Error(typed.stderr || typed.stdout);
  const smoke = spawnSync(process.execPath, [join(workspace, "smoke.mjs")], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (smoke.status !== 0)
    throw new Error(smoke.stderr || "package smoke failed");
  const installedPackage = JSON.parse(
    await readFile(
      join(workspace, "node_modules/newtondb/package.json"),
      "utf8",
    ),
  );
  if (installedPackage.version !== expectedVersion) {
    throw new Error("installed artifact version mismatch");
  }
} finally {
  await rm(workspace, { force: true, recursive: true });
  if (ownsTarball && tarball !== undefined) await rm(tarball, { force: true });
}
