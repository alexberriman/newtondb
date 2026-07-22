# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## 2.0.0-beta.0 — 2026-07-22

### Added

- Typed named collections with immutable JSON snapshots and string or safe-integer primary keys.
- Declared hash indexes, deterministic query planning, a versioned serializable query grammar, compound ordering, and generated string keys.
- Atomic collection-granular serializable transactions with revisioned receipts and bounded event delivery.
- Structural storage adapters, a memory reference adapter, adapter conformance tools, and a crash-qualified Node JSON-file adapter.
- Versioned, checksummed snapshot envelopes; explicit verified-backup recovery; exclusive cooperative writer fencing; and old-or-new crash recovery.
- ESM root, `newtondb/node`, and `newtondb/testing` entry points with locked API reports and TypeScript 6.0 declarations.
- Property, model, history, fault-injection, process-death, package-consumer, mutation, security, and deterministic performance qualification suites.

### Changed

- The package is a clean semantic-major redesign. Its API, query model, ownership rules, adapters, persistence format, and error contracts intentionally replace the historical prototype.
- Node 22.13 or newer and ESM are required.

### Removed

- Mutable result wrappers, arbitrary serializable JavaScript predicates, deep imports, implicit collection modes, unverified adapter semantics, and compatibility shims.

## Historical releases

Releases through 0.3.4 belong to the retired prototype. Their original history remains available in Git.
