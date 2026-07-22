# Performance and supported scale

NewtonDB is an in-process database whose records and indexes reside in memory. The supported reference envelope is 100,000 records, corresponding to 11.3 MB of canonical JSON for the seeded benchmark schema. This is a tested boundary, not a claim that every document shape consumes the same memory.

## Qualification evidence

The committed Node 24/Linux ARM64 baseline uses seed `0x6e657774`, three warmups, twelve measured samples, and a fresh process for each dataset size. Every timed workload checks its result so a correctness regression cannot masquerade as a speedup. The report records Node, V8, OS, architecture, memory, sample counts, confidence intervals, and both working-set and process-lifetime memory observations.

At 100,000 records the reference run measured:

| Operation                                      |      p95 |
| ---------------------------------------------- | -------: |
| Load and validate with three secondary indexes | 1,171 ms |
| Ten indexed equality hits                      | 0.074 ms |
| Ten equivalent full-scan equality hits         |   175 ms |
| One indexed record update                      |  7.17 ms |
| Durable flush after a memory commit            |   520 ms |
| Open, validate, rebuild indexes, and close     | 1,383 ms |

The canonical snapshot was 11,228,656 bytes. Post-load heap growth was 63.6 MB and post-load RSS was 335.1 MB. Declared secondary indexes accounted for approximately 11.3 MB of the measured heap delta. A one-record indexed update retained 2.7 MB in the deliberately noisy forced-GC probe—well below the full 63.6 MB root—and 100 retained event batches serialized to 44.6 KB because records are shared immutable snapshots. The benchmark also records the much larger process-lifetime RSS high-water caused by repeated load trials; that diagnostic is intentionally not presented as the resident size of one loaded database.

## Running benchmarks

```sh
npm run benchmark:smoke
npm run benchmark -- --output .benchmark/candidate.json
npm run benchmark:check
npm run benchmark:qualify
```

The smoke profile is a deterministic functional check for shared CI. The standard profile measures 1k, 10k, and 100k fixtures. Qualification fails if any requested fixture breaches the accepted absolute budgets. Regression comparison additionally requires matching report schema, Node major, architecture, operating system, seed, profile, warmups, and samples; its 25% threshold plus a 1 ms noise floor is intended for controlled hosts, not generic hosted runners.

Measurements are specific to the recorded environment and filesystem. Application document widths, index cardinality, query selectivity, storage hardware, and listener retention all change results. Consumers should run the same harness with representative data before treating the reference envelope as their production limit.

## Historical context

`benchmark/baseline-legacy-node24-linux-arm64.json` records the old implementation at the same 1k/10k/100k sizes, runtime profile, sample count, warmups, and seed. Its separate runner is retained because the old API and data structures cannot execute the current workload. The current report also includes native Array filtering and Map lookup references.

These numbers are context, not a parity claim: the current engine validates and freezes JSON, maintains declared indexes, checks transaction invariants, and offers defined persistence semantics that the historical implementation did not. Comparisons should therefore use scaling shape and operation meaning, not present a single misleading “faster” percentage.
