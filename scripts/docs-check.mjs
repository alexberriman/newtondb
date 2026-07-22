import { spawnSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const markdownFiles = ["README.md", "SECURITY.md", "CONTRIBUTING.md"];
const walkMarkdown = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walkMarkdown(path);
    else if (entry.name.endsWith(".md")) markdownFiles.push(path);
  }
};
await walkMarkdown("docs");

for (const markdown of markdownFiles) {
  const source = await readFile(markdown, "utf8");
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = match[1]?.split("#")[0];
    if (
      target === undefined ||
      target === "" ||
      /^(?:https?:|mailto:)/u.test(target)
    ) {
      continue;
    }
    await readFile(resolve(dirname(markdown), target)).catch(() => {
      throw new Error(`${markdown}: broken local link ${target}`);
    });
  }
}

const workspace = await mkdtemp(join(tmpdir(), "newtondb-docs-"));
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
  await writeFile(
    join(workspace, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  const installed = spawnSync("npm", ["install", "--ignore-scripts", tarball], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (installed.status !== 0)
    throw new Error(installed.stderr || "install failed");
  const examples = (await readdir("examples"))
    .filter((name) => name.endsWith(".mjs"))
    .sort();
  for (const example of examples) {
    await cp(join("examples", example), join(workspace, example));
    const result = spawnSync(process.execPath, [join(workspace, example)], {
      cwd: workspace,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`${example}: ${result.stderr || result.stdout}`);
    }
  }
  process.stdout.write(
    `Validated ${markdownFiles.length} Markdown files and ${examples.length} packed examples.\n`,
  );
} finally {
  await rm(workspace, { force: true, recursive: true });
  if (ownsTarball && tarball !== undefined) await rm(tarball, { force: true });
}
