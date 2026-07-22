# Architecture

NewtonDB is one ESM package with three supported entry points:

- `newtondb` — platform-neutral database, schema, query, transaction, event, error, and storage contracts.
- `newtondb/node` — the crash-qualified JSON file adapter.
- `newtondb/testing` — memory/fault adapters and the adapter conformance runner.

The engine keeps one immutable committed root. Each collection contains a primary-key map, stable insertion positions, and declared hash-index buckets. A transaction overlays only touched keys and index buckets, validates collection revisions, verifies invariants when enabled, seals its overlays, and publishes the complete next root at one linearization point. Reads expose recursively frozen detached JSON values; no mutable engine structure crosses the public boundary.

Queries are parsed into a fixed, versioned AST. The planner selects exact primary-key lookup, declared secondary equality lookup, or a bounded scan. Index execution and scan execution use the same evaluator. Ordering is explicit and deterministic, with primary key as the final tie-breaker.

Persistence is downstream of in-memory publication. The coordinator serializes generation-checked snapshots, coalesces waiters for the same revision, bounds pending work, and distinguishes memory from persisted receipts. An adapter is trusted to honor the structural contract; the conformance runner is evidence, not a security sandbox.

The Node adapter acquires exclusive cooperative ownership before load, validates a checksummed versioned envelope, writes a unique same-directory temporary file, syncs it, atomically renames it, and syncs the directory. Indexes are never authoritative on disk: they are rebuilt from validated records on open.

Internal modules are implementation details. The API reports under `etc/` and the export map in `package.json` are the public-surface authority.
