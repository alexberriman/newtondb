import { createRequire } from "node:module";
import { cpus, platform, release, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import process from "node:process";
import { writeFile } from "node:fs/promises";

const modulePath = process.argv[2];
const outputPath = process.argv[3];
if (modulePath === undefined) {
  throw new Error("Usage: node benchmark/legacy-reference.mjs <built-entry>");
}
const require = createRequire(import.meta.url);
const { Database } = require(resolve(modulePath));
const sizes = [1_000, 10_000, 100_000];
const samples = 12;
const warmups = 3;

function dataset(size) {
  let state = 0x6e657774;
  const random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
  return Array.from({ length: size }, (_, index) => ({
    id: `record-${index.toString().padStart(8, "0")}`,
    name: `Deterministic record ${random().toString(16).padStart(8, "0")}`,
    score: random() % 1_000_000,
  }));
}

function stats(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples: values.length,
  };
}

function measure(operation) {
  for (let index = 0; index < warmups; index += 1) operation();
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    operation();
    values.push(performance.now() - started);
    globalThis.gc?.();
  }
  return stats(values);
}

const results = sizes.map((size) => {
  const records = dataset(size);
  const load = measure(() => {
    const database = new Database(records, {
      collection: { primaryKey: "id" },
    });
    if (database.$.data.length !== size)
      throw new Error("legacy load mismatch");
  });
  const indexed = new Database(records, { collection: { primaryKey: "id" } });
  const indexedGet100 = measure(() => {
    for (let index = 0; index < 100; index += 1) {
      const id = `record-${(index % size).toString().padStart(8, "0")}`;
      if (indexed.$.get({ id }).data?.id !== id)
        throw new Error("legacy indexed get mismatch");
    }
  });
  const scanned = new Database(records);
  const scanFind10 = measure(() => {
    for (let index = 0; index < 10; index += 1) {
      const id = `record-${(index % size).toString().padStart(8, "0")}`;
      if (scanned.$.find({ id }).data?.[0]?.id !== id)
        throw new Error("legacy scan mismatch");
    }
  });
  return {
    canonicalBytes: Buffer.byteLength(JSON.stringify(records)),
    metricsMs: { indexedGet100, load, scanFind10 },
    records: size,
  };
});

const serialized = `${JSON.stringify(
  {
    benchmarkSchemaVersion: 1,
    environment: {
      architecture: process.arch,
      cpu: cpus()[0]?.model ?? "unknown",
      cpuCount: cpus().length,
      node: process.version,
      platform: `${platform()} ${release()}`,
      totalMemoryBytes: totalmem(),
      v8: process.versions.v8,
    },
    methodology: {
      datasetSeed: "0x6e657774",
      samples,
      sourceRevision: "a8eab0c^",
      warmups,
    },
    results,
  },
  null,
  2,
)}\n`;
if (outputPath === undefined) process.stdout.write(serialized);
else await writeFile(outputPath, serialized, "utf8");
