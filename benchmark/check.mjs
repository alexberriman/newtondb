import { readFile } from "node:fs/promises";
import process from "node:process";

const [baselinePath, candidatePath] = process.argv.slice(2);
if (baselinePath === undefined || candidatePath === undefined) {
  throw new Error("Usage: node benchmark/check.mjs <baseline> <candidate>");
}

const readReport = async (path) => JSON.parse(await readFile(path, "utf8"));
const [baseline, candidate] = await Promise.all([
  readReport(baselinePath),
  readReport(candidatePath),
]);

const failures = [];
const requireEqual = (label, left, right) => {
  if (left !== right) failures.push(`${label} differs: ${left} !== ${right}`);
};
requireEqual(
  "benchmark schema",
  baseline.benchmarkSchemaVersion,
  candidate.benchmarkSchemaVersion,
);
requireEqual(
  "Node major",
  baseline.environment.node.split(".")[0],
  candidate.environment.node.split(".")[0],
);
requireEqual(
  "architecture",
  baseline.environment.architecture,
  candidate.environment.architecture,
);
requireEqual(
  "operating system",
  baseline.environment.platform.split(" ")[0],
  candidate.environment.platform.split(" ")[0],
);
requireEqual(
  "dataset seed",
  baseline.methodology.datasetSeed,
  candidate.methodology.datasetSeed,
);
requireEqual(
  "profile",
  baseline.methodology.profile,
  candidate.methodology.profile,
);
requireEqual(
  "samples",
  baseline.methodology.samples,
  candidate.methodology.samples,
);
requireEqual(
  "warmups",
  baseline.methodology.warmups,
  candidate.methodology.warmups,
);

const baselineBySize = new Map(
  baseline.results.map((result) => [result.records, result]),
);
for (const result of candidate.results) {
  const reference = baselineBySize.get(result.records);
  if (reference === undefined) {
    failures.push(`No baseline for ${result.records} records`);
    continue;
  }
  for (const [name, metric] of Object.entries(result.metricsMs)) {
    const baselineMetric = reference.metricsMs[name];
    if (baselineMetric === undefined) {
      failures.push(`No baseline metric ${name} at ${result.records} records`);
      continue;
    }
    const allowed = Math.max(baselineMetric.p95 * 1.25, baselineMetric.p95 + 1);
    if (metric.p95 > allowed) {
      failures.push(
        `${result.records}/${name}: p95 ${metric.p95.toFixed(3)}ms exceeds ${allowed.toFixed(3)}ms`,
      );
    }
  }
}

const requiredEnvelope = baseline.qualification.largestPassingRecordCount;
if (
  requiredEnvelope !== null &&
  (candidate.qualification.largestPassingRecordCount ?? 0) < requiredEnvelope
) {
  failures.push(`Qualified envelope fell below ${requiredEnvelope} records`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    "Benchmark candidate is within the regression budget.\n",
  );
}
