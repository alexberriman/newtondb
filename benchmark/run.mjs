import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { cpus, freemem, platform, release, totalmem } from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import packageJson from "../package.json" with { type: "json" };

import { Database, collectionSchema, where } from "../dist/index.js";
import { JsonFileAdapter } from "../dist/node/index.js";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const profile = option(
  "--profile",
  args.includes("--smoke") ? "smoke" : "standard",
);
if (!new Set(["smoke", "standard", "qualification"]).has(profile)) {
  throw new Error(`Unknown benchmark profile: ${profile}`);
}
const sizes = option(
  "--sizes",
  profile === "smoke" ? "1000" : "1000,10000,100000",
)
  .split(",")
  .map(Number);
const samples = Number(option("--samples", profile === "smoke" ? "3" : "12"));
const warmups = Number(option("--warmups", profile === "smoke" ? "1" : "3"));
const outputPath = option("--output", undefined);
const child = args.includes("--child");
if (
  sizes.some((size) => !Number.isSafeInteger(size) || size <= 0) ||
  !Number.isSafeInteger(samples) ||
  samples < 2 ||
  !Number.isSafeInteger(warmups) ||
  warmups < 0
) {
  throw new Error("Invalid benchmark sizes, samples, or warmups");
}

const schema = {
  records: collectionSchema({
    indexes: [
      { name: "by-active", path: ["active"] },
      { name: "by-group", path: ["group"] },
      { name: "by-score", path: ["score"] },
    ],
    primaryKey: "id",
  }),
};

function dataset(size) {
  let state = 0x6e657774;
  const random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
  return Array.from({ length: size }, (_, index) => ({
    active: (random() & 1) === 0,
    group: `group-${random() % 100}`,
    id: `record-${index.toString().padStart(8, "0")}`,
    name: `Deterministic record ${random().toString(16).padStart(8, "0")}`,
    score: random() % 1_000_000,
  }));
}

function percentile(sorted, fraction) {
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

function statistics(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, values.length - 1);
  const margin95 = 1.96 * Math.sqrt(variance / values.length);
  return {
    ci95: [mean - margin95, mean + margin95],
    mean,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    samples: values.length,
  };
}

async function measure(operation, afterEach = () => undefined) {
  for (let index = 0; index < warmups; index += 1) {
    await operation();
    await afterEach();
  }
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    await operation();
    values.push(performance.now() - started);
    await afterEach();
  }
  return statistics(values);
}

async function qualify(size) {
  const records = dataset(size);
  const canonicalBytes = Buffer.byteLength(JSON.stringify({ records }));
  globalThis.gc?.();
  const rssBefore = process.memoryUsage().rss;
  const heapBefore = process.memoryUsage().heapUsed;
  const database = Database.memory({ records }, { schema });
  globalThis.gc?.();
  const loadedMemory = process.memoryUsage();
  const rssDelta = Math.max(0, loadedMemory.rss - rssBefore);
  const heapDelta = Math.max(0, loadedMemory.heapUsed - heapBefore);
  const scannedDatabase = Database.memory(
    { records },
    { schema: { records: collectionSchema({ primaryKey: "id" }) } },
  );
  const nativeMap = new Map(records.map((record) => [record.id, record]));
  const load = await measure(
    () => {
      const loaded = Database.memory({ records }, { schema });
      if (loaded.collection("records").count !== size)
        throw new Error("load mismatch");
    },
    () => globalThis.gc?.(),
  );
  const w = where();
  const hitScores = records.slice(0, 10).map(({ score }) => score);
  const scoreCounts = new Map();
  for (const { score } of records) {
    scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
  }
  const expectedHitCount = hitScores.reduce(
    (count, score) => count + scoreCounts.get(score),
    0,
  );
  const indexedEqualityHit = await measure(() => {
    let count = 0;
    for (const score of hitScores) {
      count += database
        .collection("records")
        .findMany(w.eq("score", score)).length;
    }
    if (count !== expectedHitCount) throw new Error("indexed hit mismatch");
  });
  const indexedEqualityMiss = await measure(() => {
    let count = 0;
    for (let index = 1; index <= 10; index += 1) {
      count += database
        .collection("records")
        .findMany(w.eq("score", -index)).length;
    }
    if (count !== 0) throw new Error("indexed miss mismatch");
  });
  const scannedEqualityHit = await measure(() => {
    let count = 0;
    for (const score of hitScores) {
      count += scannedDatabase
        .collection("records")
        .findMany(w.eq("score", score)).length;
    }
    if (count !== expectedHitCount) throw new Error("scan hit mismatch");
  });
  const nativeArrayEquality = await measure(() => {
    let count = 0;
    for (const expected of hitScores) {
      count += records.filter(({ score }) => score === expected).length;
    }
    if (count !== expectedHitCount) throw new Error("native hit mismatch");
  });
  const nativeMapGet = await measure(() => {
    for (let index = 0; index < 100; index += 1) {
      nativeMap.get(`record-${(index % size).toString().padStart(8, "0")}`);
    }
  });
  const scanComparison = await measure(() => {
    const found = database
      .collection("records")
      .findMany(w.gte("score", 500_000));
    if (found.length === 0 || found.length >= size) {
      throw new Error("comparison selectivity mismatch");
    }
  });
  const compoundSortLimit = await measure(() => {
    database
      .collection("records")
      .query(w.and(w.eq("active", true), w.gte("score", 500_000)))
      .orderBy("group")
      .thenBy("score", "desc")
      .limit(25)
      .toArray();
  });
  let mutationSequence = 0;
  const oneRecordUpdate = await measure(async () => {
    const id = `record-${(mutationSequence++ % size).toString().padStart(8, "0")}`;
    const score = mutationSequence;
    await database.collection("records").update(id, { score });
    if (database.collection("records").getOrThrow(id).score !== score) {
      throw new Error("update mismatch");
    }
  });
  const rejectedKeyChange = await measure(async () => {
    try {
      await database.collection("records").update("record-00000000", {
        id: "changed",
      });
      throw new Error("key change unexpectedly succeeded");
    } catch (error) {
      if (error?.code !== "ERR_IMMUTABLE_PRIMARY_KEY") throw error;
    }
  });
  let insertedSequence = 0;
  const insertedIds = [];
  const insert = await measure(async () => {
    const id = `inserted-${insertedSequence++}`;
    insertedIds.push(id);
    await database.collection("records").insert({
      active: true,
      group: "benchmark",
      id,
      name: "Inserted benchmark record",
      score: insertedSequence,
    });
    if (!database.collection("records").has(id)) {
      throw new Error("insert mismatch");
    }
  });
  let deleteSequence = 0;
  const deletion = await measure(async () => {
    const id = insertedIds[deleteSequence++];
    if (id === undefined) throw new Error("delete fixture mismatch");
    await database.collection("records").delete(id);
    if (database.collection("records").has(id)) {
      throw new Error("delete mismatch");
    }
  });
  let transactionSequence = 0;
  const transaction100 = await measure(async () => {
    await database.transaction((transaction) => {
      const collection = transaction.collection("records");
      for (let index = 0; index < Math.min(100, size); index += 1) {
        collection.update(`record-${index.toString().padStart(8, "0")}`, {
          score: transactionSequence + index,
        });
      }
    });
    transactionSequence += 100;
  });
  const serialization = await measure(() => {
    const json = JSON.stringify(database.collection("records").toArray());
    if (json.length === 0) throw new Error("serialization mismatch");
  });

  const directory = await mkdtemp(
    join(process.env.RUNNER_TEMP ?? "/tmp", "newtondb-bench-"),
  );
  const path = join(directory, "database.json");
  let flushLatest;
  let persistedUpdate;
  let recovery;
  try {
    const persistent = await Database.open({
      adapter: new JsonFileAdapter(path),
      initialData: { records },
      schema,
    });
    persistedUpdate = await measure(async () => {
      await persistent
        .collection("records")
        .update("record-00000000", { score: mutationSequence++ });
    });
    flushLatest = await measure(async () => {
      await persistent.transaction(
        (transaction) => {
          transaction
            .collection("records")
            .update("record-00000000", { score: mutationSequence++ });
        },
        { durability: "memory" },
      );
      await persistent.flush();
    });
    await persistent.close();
    recovery = await measure(
      async () => {
        const reopened = await Database.open({
          adapter: new JsonFileAdapter(path),
          schema,
        });
        if (reopened.collection("records").count !== size)
          throw new Error("recovery mismatch");
        await reopened.close();
      },
      () => globalThis.gc?.(),
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }

  return {
    canonicalBytes,
    heapDeltaBytes: heapDelta,
    loadedHeapBytes: loadedMemory.heapUsed,
    loadedRssBytes: loadedMemory.rss,
    heapToCanonicalRatio: heapDelta / canonicalBytes,
    metricsMs: {
      compoundSortLimit,
      delete: deletion,
      flushLatest,
      indexedEqualityHit10: indexedEqualityHit,
      indexedEqualityMiss10: indexedEqualityMiss,
      insert,
      load,
      nativeArrayEquality,
      nativeMapGet100: nativeMapGet,
      oneRecordUpdate,
      openExistingAndClose: recovery,
      persistedUpdate,
      rejectedKeyChange,
      scanComparison,
      serialization,
      transaction100,
      scannedEqualityHit10: scannedEqualityHit,
    },
    records: size,
    executionPeakRssBytes: process.resourceUsage().maxRSS * 1_024,
    rssBytes: process.memoryUsage().rss,
    rssDeltaBytes: rssDelta,
    rssToCanonicalRatio: rssDelta / canonicalBytes,
  };
}

const budgets = {
  flushLatestP95Ms: 1_000,
  heapFixedOverheadBytes: 8 * 1_024 * 1_024,
  heapToCanonicalRatio: 6,
  loadP95Ms: 3_000,
  loadedRssBytes: 536_870_912,
  recoveryP95Ms: 3_000,
};
const budgetViolations = (result) => {
  const violations = [];
  const heapLimit =
    budgets.heapFixedOverheadBytes +
    result.canonicalBytes * budgets.heapToCanonicalRatio;
  if (result.heapDeltaBytes > heapLimit)
    violations.push(`heap ${result.heapDeltaBytes} > ${heapLimit}`);
  if (result.loadedRssBytes > budgets.loadedRssBytes)
    violations.push(
      `loaded RSS ${result.loadedRssBytes} > ${budgets.loadedRssBytes}`,
    );
  if (result.metricsMs.flushLatest.p95 > budgets.flushLatestP95Ms)
    violations.push(
      `flush p95 ${result.metricsMs.flushLatest.p95} > ${budgets.flushLatestP95Ms}`,
    );
  if (result.metricsMs.load.p95 > budgets.loadP95Ms)
    violations.push(
      `load p95 ${result.metricsMs.load.p95} > ${budgets.loadP95Ms}`,
    );
  if (result.metricsMs.openExistingAndClose.p95 > budgets.recoveryP95Ms)
    violations.push(
      `open p95 ${result.metricsMs.openExistingAndClose.p95} > ${budgets.recoveryP95Ms}`,
    );
  return violations;
};
const passingResults = (results) =>
  results.filter((result) => budgetViolations(result).length === 0);
const environment = {
  architecture: process.arch,
  cpu: cpus()[0]?.model ?? "unknown",
  cpuCount: cpus().length,
  freeMemoryBytesAtEnd: freemem(),
  node: process.version,
  platform: `${platform()} ${release()}`,
  totalMemoryBytes: totalmem(),
  v8: process.versions.v8,
};
const methodology = {
  clock: "performance.now",
  confidenceInterval: "normal approximation, 95%",
  datasetSeed: "0x6e657774",
  gcExposed: typeof globalThis.gc === "function",
  profile,
  processIsolation: "one fresh Node.js process per dataset size",
  samples,
  warmups,
};
const createReport = (results) => {
  const qualified = passingResults(results);
  return {
    benchmarkSchemaVersion: 1,
    budgets,
    environment,
    methodology,
    qualification: {
      failures: results.flatMap((result) => {
        const violations = budgetViolations(result);
        return violations.length === 0
          ? []
          : [{ records: result.records, violations }];
      }),
      largestPassingRecordCount: qualified.at(-1)?.records ?? null,
      passedSizes: qualified.map(({ records }) => records),
    },
    package: { name: packageJson.name, version: packageJson.version },
    results,
  };
};

let report;
if (!child && sizes.length > 1) {
  const script = fileURLToPath(import.meta.url);
  const results = sizes.map((size) => {
    const stdout = execFileSync(
      process.execPath,
      [
        ...process.execArgv,
        script,
        "--child",
        "--sizes",
        String(size),
        "--samples",
        String(samples),
        "--warmups",
        String(warmups),
        "--profile",
        profile,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1_024 * 1_024 },
    );
    const childReport = JSON.parse(stdout);
    if (childReport.results.length !== 1) {
      throw new Error(`Benchmark child for ${size} returned invalid results`);
    }
    return childReport.results[0];
  });
  report = createReport(results);
} else {
  const results = [];
  for (const size of sizes) results.push(await qualify(size));
  report = createReport(results);
}
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath === undefined) process.stdout.write(serialized);
else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  process.stdout.write(`Wrote ${outputPath}\n`);
}
if (profile === "qualification" && report.qualification.failures.length > 0) {
  process.stderr.write(
    `${report.qualification.failures
      .map(({ records, violations }) => `${records}: ${violations.join(", ")}`)
      .join("\n")}\n`,
  );
  process.exitCode = 1;
}
