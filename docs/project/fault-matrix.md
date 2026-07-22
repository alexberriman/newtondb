# Named fault-injection matrix

Each row must have a deterministic fixture before its owning milestone exits.

## Engine and transactions

- validator throws at each document and write-set position;
- duplicate/missing/changed primary key;
- secondary-index add/remove failure before publication;
- conflict after point read, predicate read, write-only transaction, and cross-collection read/write;
- callback throws, returns a promise, nests/re-enters, exceeds age/operation/result limits;
- listener throws, unsubscribes during dispatch, commits reentrantly, exceeds queue/payload limit.

## Persistence coordinator

- adapter resolves late, out of order, rejects, hangs until abort, and reports wrong database/generation/revision;
- coalesced waiter before/between/after snapshots;
- queue overflow, retry exhaustion, flush during commit, concurrent flush, close during flush, repeated close;
- persistence failure after in-memory publication retains committed receipt.

## Node file storage

- lock create/acquire/contention/stale-owner/fencing/release and process-fork behavior;
- source stat/read/size/UTF-8/BOM/parse/checksum/catalog failures;
- temp create, partial and short write, file sync, close, rename/replace, directory sync;
- disk full/quota, permission change, read-only mount, destination disappearance;
- stale temp with lower/higher/equal/corrupt revision; corrupt primary plus valid/invalid backup;
- symlink/hardlink and path replacement races according to supported-platform policy;
- crash child process at every instrumented boundary, then assert a complete valid old-or-new snapshot.

The maintained crash boundary set is `before-temp-open`, `after-temp-open`, `after-write`, `after-file-sync`, `after-temp-close`, `after-rename`, and `after-directory-sync`. Read-side fixtures cover missing, malformed, BOM, invalid UTF-8/JSON, oversized, bad checksum, incompatible catalog, symlink, hard-link, corrupt primary/backup, and explicit verified-backup recovery. File reads use one no-follow file descriptor for stat and bytes, avoiding a path swap between validation and read. Lock fixtures cover live contention, malformed/dead recovery, PID-reuse conservatism, token replacement, stale crash ownership, cross-process release, and foreign-token preservation.

The crash-qualified platform matrix is Linux on local filesystems with same-directory atomic rename and working file/directory sync. Network/FUSE and Windows/macOS replacement behavior remain unsupported rather than being represented by an untested matrix row.

## Package and release

- missing/extra export, unresolved declaration/source map, ESM import failure, Node version rejection;
- package/tag/changelog/artifact version mismatch;
- built tarball digest differs from promoted/downloaded artifact;
- new, worsened, or expired dependency exception.
