import { readFile } from "node:fs/promises";
import process from "node:process";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const allowed = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "ISC",
  "MIT",
  "MPL-2.0",
  "Python-2.0",
]);
const reviewedMissingMetadata = new Map([
  ["node_modules/@andrewbranch/untar.js", "MIT license file"],
]);
const failures = [];
const counts = new Map();

for (const [path, metadata] of Object.entries(lock.packages)) {
  if (path === "") continue;
  const license = metadata.license;
  if (typeof license === "string" && allowed.has(license)) {
    counts.set(license, (counts.get(license) ?? 0) + 1);
  } else if (license === undefined && reviewedMissingMetadata.has(path)) {
    const disposition = reviewedMissingMetadata.get(path);
    counts.set(disposition, (counts.get(disposition) ?? 0) + 1);
  } else {
    failures.push(`${path}: ${license ?? "missing license metadata"}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Unapproved dependency licenses:\n${failures.join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  const summary = [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([license, count]) => `${license}=${count}`)
    .join(", ");
  process.stdout.write(`Dependency licenses approved: ${summary}\n`);
}
