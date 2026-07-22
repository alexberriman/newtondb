import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { clearTimeout, setTimeout } from "node:timers";

import { Database, collectionSchema } from "../dist/index.js";
import { JsonFileAdapter } from "../dist/node/index.js";

const directory = await mkdtemp(join(tmpdir(), "newtondb-lock-"));
const path = join(directory, "database.json");
const schema = { records: collectionSchema({ primaryKey: "id" }) };
let child;

try {
  const initial = await Database.open({
    adapter: new JsonFileAdapter(path),
    initialData: { records: [] },
    schema,
  });
  await initial.close();

  child = spawn(
    process.execPath,
    [fileURLToPath(new URL("lock-child.mjs", import.meta.url)), path],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(
      () => reject(new Error("Lock child readiness timed out")),
      5_000,
    );
    child.once("error", reject);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(`Lock child exited ${code} before readiness: ${stderr}`),
      );
    });
    child.stdout.once("data", (chunk) => {
      clearTimeout(timer);
      if (String(chunk).includes("READY")) resolve();
      else reject(new Error(`Unexpected lock child output: ${String(chunk)}`));
    });
  });

  let conflict = false;
  let unexpectedDatabase;
  try {
    unexpectedDatabase = await Database.open({
      adapter: new JsonFileAdapter(path),
      schema,
    });
  } catch (error) {
    conflict = error?.code === "ERR_STORAGE_CONFLICT";
  }
  await unexpectedDatabase?.close();
  if (!conflict) throw new Error("A second process was not excluded");

  child.stdin.end("close\n");
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));
  if (exitCode !== 0) throw new Error(`Lock owner exited with ${exitCode}`);

  const reopened = await Database.open({
    adapter: new JsonFileAdapter(path),
    schema,
  });
  await reopened.close();
  process.stdout.write(
    "Validated cross-process writer exclusion and release\n",
  );
} finally {
  if (child !== undefined && child.exitCode === null) child.kill("SIGKILL");
  await rm(directory, { force: true, recursive: true });
}
