import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const svg = await readFile("static/newton.svg", "utf8");
const checks = [];
const pass = (name, assertions) => {
  const failed = assertions
    .filter(({ ok }) => !ok)
    .map(({ message }) => message);
  if (failed.length > 0) throw new Error(`${name}: ${failed.join("; ")}`);
  checks.push({ name, result: "pass" });
};

pass("1. Safe SVG structure", [
  { message: "missing SVG root", ok: svg.startsWith("<svg") },
  { message: "script element present", ok: !/<script\b/iu.test(svg) },
  { message: "foreignObject present", ok: !/<foreignObject\b/iu.test(svg) },
  {
    message: "external URL present",
    ok: !/(?:href|src)=["']https?:/iu.test(svg),
  },
]);
pass("2. Accessible identity", [
  { message: "missing img role", ok: /role="img"/u.test(svg) },
  { message: "missing title", ok: /<title\s+id=/u.test(svg) },
  { message: "missing description", ok: /<desc\s+id=/u.test(svg) },
  { message: "missing aria linkage", ok: /aria-labelledby="[^"]+"/u.test(svg) },
]);
pass("3. Scalable geometry", [
  { message: "unexpected viewBox", ok: /viewBox="0 0 512 512"/u.test(svg) },
  { message: "fixed bitmap embedded", ok: !/<image\b/iu.test(svg) },
  {
    message: "insufficient vector detail",
    ok: (svg.match(/<(?:path|ellipse|circle)\b/gu) ?? []).length >= 20,
  },
]);
pass("4. Deliberate visual system", [
  { message: "missing dark foundation", ok: svg.includes("#050817") },
  { message: "missing data cyan", ok: svg.includes("#77F2D0") },
  { message: "missing apple accent", ok: svg.includes("#FF5C6C") },
  {
    message: "missing reusable gradients",
    ok: (svg.match(/Gradient\b/gu) ?? []).length >= 8,
  },
]);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const readme = await readFile("README.md", "utf8");
pass("5. Product integration", [
  {
    message: "README does not reference mark",
    ok: readme.includes("static/newton.svg"),
  },
  {
    message: "package omits mark",
    ok: packageJson.files.includes("static/newton.svg"),
  },
  { message: "mark is excessively large", ok: Buffer.byteLength(svg) < 20_000 },
]);

const report = `# Newton mark evaluation\n\n${checks
  .map(({ name, result }) => `- ${name}: **${result}**`)
  .join(
    "\n",
  )}\n\nThe five-pass harness is reproducible with \`npm run logo:check\`. It verifies security, accessibility, resolution-independent geometry, the intended palette/detail system, and product/package integration. Visual review additionally checks silhouette clarity at avatar and README sizes.\n`;
await writeFile("docs/project/logo-evaluation.md", report, "utf8");
process.stdout.write("Newton mark passed all five evaluation passes.\n");
