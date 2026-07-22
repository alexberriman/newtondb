import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const [reviewedJsonPath, registryJsonPath] = process.argv.slice(2);
if (reviewedJsonPath === undefined || registryJsonPath === undefined) {
  throw new Error(
    "Usage: verify-published <reviewed-pack.json> <registry-pack.json>",
  );
}
const packPath = async (jsonPath) => {
  const report = JSON.parse(await readFile(jsonPath, "utf8"));
  const filename = report[0]?.filename;
  if (typeof filename !== "string")
    throw new Error(`${jsonPath} has no filename`);
  return resolve(dirname(jsonPath), filename);
};
const reviewed = await packPath(reviewedJsonPath);
const registry = await packPath(registryJsonPath);
const digest = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const [reviewedDigest, registryDigest] = await Promise.all([
  digest(reviewed),
  digest(registry),
]);
if (reviewedDigest !== registryDigest) {
  throw new Error(
    `Registry digest ${registryDigest} differs from reviewed ${reviewedDigest}`,
  );
}
process.stdout.write(`${registryDigest}  ${registry}\n`);
