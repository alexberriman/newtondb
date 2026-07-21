import { readFile } from "node:fs/promises";
import process from "node:process";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const tag = process.env.RELEASE_TAG;

if (typeof tag !== "string" || tag.length === 0) {
  throw new Error("RELEASE_TAG is required");
}
if (tag !== `v${packageJson.version}`) {
  throw new Error(
    `Release tag ${tag} does not match package version v${packageJson.version}`,
  );
}
