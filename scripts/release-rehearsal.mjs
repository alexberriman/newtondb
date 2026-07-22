import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const workspace = await mkdtemp(join(tmpdir(), "newtondb-release-"));
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: resolve("."),
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
};

let tarball;
try {
  run("npm", ["run", "build"]);
  const packed = spawnSync(
    "npm",
    ["pack", "--json", "--pack-destination", workspace],
    {
      cwd: resolve("."),
      encoding: "utf8",
    },
  );
  if (packed.status !== 0) throw new Error(packed.stderr || "npm pack failed");
  const filename = JSON.parse(packed.stdout)[0]?.filename;
  if (typeof filename !== "string")
    throw new Error("npm pack returned no file");
  tarball = join(workspace, filename);

  const digest = createHash("sha256")
    .update(await readFile(tarball))
    .digest("hex");
  process.stdout.write(`Reviewed artifact: ${filename} sha256:${digest}\n`);

  for (let pass = 1; pass <= 2; pass += 1) {
    process.stdout.write(`Release rehearsal ${pass}/2\n`);
    run(process.execPath, ["scripts/package-smoke.mjs", tarball]);
    run(process.execPath, ["scripts/docs-check.mjs", tarball]);
  }
} finally {
  await rm(workspace, { force: true, recursive: true });
}
