import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const [manifestPath, outputPath] = process.argv.slice(2);
if (manifestPath === undefined || outputPath === undefined) {
  throw new Error("Usage: node scripts/hash-pack.mjs <pack-json> <output>");
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const filename = manifest[0]?.filename;
if (typeof filename !== "string")
  throw new Error("Pack manifest has no filename");
const digest = createHash("sha256")
  .update(await readFile(filename))
  .digest("hex");
await writeFile(outputPath, `${digest}  ${filename}\n`, "utf8");
