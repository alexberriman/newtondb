import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name !== "manifest.json") files.push(path);
  }
};
await walk("dist");
files.sort();
const manifest = {
  files: Object.fromEntries(
    await Promise.all(
      files.map(async (path) => [
        relative("dist", path),
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      ]),
    ),
  ),
  version: packageJson.version,
};
await writeFile("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
