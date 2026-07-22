# Durability and recovery

## Durability vocabulary

A memory commit is visible to this process but may not survive its loss. A persisted commit resolves only after the adapter acknowledges a crash-recoverable snapshot containing at least that revision. `flush()` captures the current revision and waits until storage covers it. `close()` flushes outstanding memory work before releasing storage ownership.

If persistence rejects, the database becomes `degraded`. The mutation remains committed in memory and the thrown `PersistenceError` carries its receipt. Durable work is rejected until `flush()` succeeds; volatile work requires explicit `allowVolatileWhenDegraded`. Retrying the transaction is unsafe because it can duplicate application effects.

## Node file adapter

`JsonFileAdapter` is crash-qualified on maintained Linux Node 22/24 runners and local filesystems providing same-directory atomic rename plus file and directory sync. Network filesystems, FUSE, Windows replacement semantics, and macOS are not crash-qualified. Use a private directory writable only by the application account.

The adapter acquires a cooperative exclusive lock before reading, checks a random fencing token before load and replacement, refuses symlinks and hard-linked primary files, bounds bytes, rejects BOM/invalid UTF-8/duplicate keys, verifies SHA-256, validates the snapshot/catalog, writes mode `0600`, and uses synced temporary-file replacement. Other processes must obey the same lock protocol. A same-user process that can modify the directory can deny service, replace data, recompute checksums, or roll storage back.

The checksum detects accidental corruption only. It is not a MAC, signature, or monotonic rollback defense.

## Backup recovery

Before replacing an existing primary, the adapter installs a verified copy at `<path>.backup`. Opening never silently uses it. If the primary is missing or corrupt and the backup is valid, open fails unless `recoverFromBackup: true` is explicitly supplied. Recovery installs a newly serialized and synced copy while exclusive ownership is held, then revalidates through normal open.

If both files are corrupt, stop the application, preserve the directory for investigation, and restore a separately verified operational backup. Do not edit checksums or delete lock files while a process may be alive.

## Operational restore

1. Stop every cooperative writer and verify no process owns the lock.
2. Copy the database, backup, and metadata to incident storage before changing anything.
3. Verify source checksum, database identity, catalog, generation, and revision in an isolated directory.
4. Restore to a new same-filesystem path with the intended owner and mode; never overwrite the only copy.
5. Open with the exact application/package/schema pairing, query representative records, close, and reopen.
6. Atomically switch the application path only after verification, then retain the replaced files through the incident window.

Package rollback and data rollback are separate. An older package may refuse a newer snapshot format; move the dist-tag or application binary only with its compatible verified data copy.

NewtonDB ships no recovery CLI. Recovery is an explicit adapter option exercised through application code, so there is no command JSON or exit-code contract to automate accidentally.
