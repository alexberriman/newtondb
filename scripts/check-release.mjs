import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import process from "node:process";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const sourceManifest = JSON.parse(
  await readFile("release/source-manifest.json", "utf8"),
);
const builtManifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const changelog = await readFile("CHANGELOG.md", "utf8");
const tag = process.env.RELEASE_TAG;

if (typeof tag !== "string" || tag.length === 0) {
  throw new Error("RELEASE_TAG is required");
}
if (tag !== `v${packageJson.version}`) {
  throw new Error(
    `Release tag ${tag} does not match package version v${packageJson.version}`,
  );
}
if (
  sourceManifest.version !== packageJson.version ||
  builtManifest.version !== packageJson.version
) {
  throw new Error(
    "Package, source manifest, and built manifest versions differ",
  );
}
if (!changelog.includes(`## ${packageJson.version}`)) {
  throw new Error(`CHANGELOG.md has no ${packageJson.version} release entry`);
}
if (process.env.GITHUB_ACTIONS === "true") {
  const ancestor = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", "HEAD", "origin/main"],
    { encoding: "utf8" },
  );
  if (ancestor.status !== 0) {
    throw new Error("Release tag commit is not contained in protected main");
  }
}
