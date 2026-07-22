# Threat model

## Assets and trust boundaries

Assets are committed JSON records, database identity/revision, durability acknowledgements, filesystem ownership, event payloads, and the reviewed npm artifact. NewtonDB accepts untrusted parsed JSON records and serializable query data within hard limits. Custom adapters, validators, local predicates, proxies, listeners, diagnostic hooks, and code with write access to the storage directory are trusted application components.

The engine defends against prototype traversal, accessors in stored JSON, key-domain collision, malformed query ASTs, query resource amplification, partial transaction publication, stale cooperative writers, accidental file corruption, and process death during replacement. Property/model tests, named failpoints, real child-process crashes, mutation checks, API reports, dependency audit, and package-consumer tests provide evidence.

## Input and denial-of-service controls

- Documents: plain JSON only; 64 depth, 100,000 nodes, 1 MiB exact serialized bytes, 256 KiB string/key ceiling.
- Queries: 32 depth, 1,000 AST nodes, 32 path tokens, 10,000 `in` values, 256 KiB per scalar, 1 MiB aggregate scalar bytes.
- Execution: 100,000 candidates/results/sort matches and eight order fields.
- Transactions: 30 seconds, 10,000 operations, 1,000 read collections.
- Events: 1,024 queued batches and 100,000 queued changes; documents omitted by default.
- Persistence: 256 pending snapshots and 64 MiB Node-file input by default.

Overrides can narrow safety ceilings but cannot enlarge them. Synchronous JavaScript and proxy traps cannot be preempted; do not pass hostile proxies or callbacks.

## Filesystem attacker

The Node adapter is cooperative concurrency control, not a sandbox against a malicious same-user process. A process with directory write access can create a live-PID lock to deny service, replace primary/backup files, and recompute checksums. Private directory ownership and operating-system ACLs are the security boundary. Checksums are not authenticity or rollback protection.

No crash-safety claim is made for network/FUSE filesystems or unqualified operating systems. Symlink, hard-link, descriptor/path-swap, token-replacement, stale-lock, corrupt-backup, and generation-conflict cases fail closed under the supported local-filesystem assumptions.

## Privacy and observability

Errors serialize metadata only, but raw causes may originate in application validators/adapters. Event documents are opt-in and hooks receive the projected batch. Do not log raw records, batches, paths, credentials, or causes without redaction and size limits. NewtonDB provides no encryption at rest; use filesystem encryption and application-level field protection where required.

## Supply chain

The package has no runtime dependencies. CI installs with lifecycle scripts disabled, audits the complete development tree, checks an explicit license allowlist, reviews dependency diffs, locks API reports, and packs one allowlisted ESM artifact. Release uses OIDC provenance and a reviewed tarball digest. Repository/environment protection and two-person approval are administrative controls described in the release runbook.

## Independent review disposition

An adversarial review identified escaping post-commit diagnostics, unbounded query execution, approximate JSON byte accounting, shallow envelopes, duplicate-key parsing, adapter-load cleanup, coercive containment, unsafe limit overrides, event privacy, and documentation drift. Runtime findings were remediated with regression tests. Remaining environmental risks—trusted callbacks/adapters, malicious directory writers, checksum non-authenticity, synchronous non-preemption, and platform qualification—are explicit non-goals rather than hidden guarantees.
