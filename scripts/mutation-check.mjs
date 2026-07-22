import { spawnSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const mutants = [
  {
    file: "src/key.ts",
    from: "return `n:${key}`;",
    name: "numeric/string primary-key collision",
    test: "test/primitives-property.test.ts",
    to: "return `s:${String(key).length}:${key}`;",
  },
  {
    file: "src/database.ts",
    from: "if (current.revision !== baseRevision) conflicts.push(name);",
    name: "disabled optimistic conflict check",
    test: "test/transaction.test.ts",
    to: "if (current.revision === baseRevision) conflicts.push(name);",
  },
  {
    file: "src/query.ts",
    from: "return samePrimitive(source, value as JsonPrimitive);",
    name: "equality predicate always true",
    test: "test/query.test.ts",
    to: "return true;",
  },
  {
    file: "src/path.ts",
    from: "current = Object.getOwnPropertyDescriptor(current, token)?.value;",
    name: "path accessor execution",
    test: "test/path.test.ts",
    to: "current = current[token];",
  },
  {
    file: "src/json.ts",
    from: "if (!Number.isFinite(value)) {",
    name: "non-finite JSON number accepted",
    test: "test/json.test.ts",
    to: "if (false) {",
  },
  {
    file: "src/node/json-file-adapter.ts",
    from: "if (info.nlink !== 1) {",
    name: "hard-link protection removed",
    test: "test/node-storage.test.ts",
    to: "if (false) {",
  },
];

const root = resolve(".");
const vitest = resolve("node_modules/vitest/vitest.mjs");
for (const mutant of mutants) {
  const workspace = await mkdtemp(join(tmpdir(), "newtondb-mutant-"));
  try {
    await Promise.all([
      cp(resolve("src"), join(workspace, "src"), { recursive: true }),
      cp(resolve("test"), join(workspace, "test"), { recursive: true }),
      cp(resolve("package.json"), join(workspace, "package.json")),
      cp(resolve("tsconfig.json"), join(workspace, "tsconfig.json")),
      cp(resolve("vitest.config.ts"), join(workspace, "vitest.config.ts")),
      symlink(resolve("node_modules"), join(workspace, "node_modules"), "dir"),
    ]);
    const path = join(workspace, mutant.file);
    const source = await readFile(path, "utf8");
    const first = source.indexOf(mutant.from);
    if (first < 0 || first !== source.lastIndexOf(mutant.from)) {
      throw new Error(`${mutant.name}: mutation target is not unique`);
    }
    await writeFile(path, source.replace(mutant.from, mutant.to), "utf8");
    const result = spawnSync(process.execPath, [vitest, "run", mutant.test], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    if (result.status === 0) {
      throw new Error(`${mutant.name}: survived ${mutant.test}`);
    }
    process.stdout.write(`Killed mutant: ${mutant.name}\n`);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}
process.stdout.write(
  `Killed all ${mutants.length} critical mutants in ${root}.\n`,
);
