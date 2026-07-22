import process from "node:process";
import { pathToFileURL } from "node:url";

export function releaseDistTag(version) {
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)
  ) {
    throw new Error(`Invalid semantic version: ${String(version)}`);
  }
  const prerelease = version.split("-", 2)[1];
  if (prerelease === undefined) return "latest";
  const channel = prerelease.split(".", 1)[0]?.toLowerCase();
  if (channel === "beta" || channel === "rc") return channel;
  return "next";
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.stdout.write(`${releaseDistTag(process.argv[2])}\n`);
}
