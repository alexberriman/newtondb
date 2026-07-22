import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  CorruptStorageError,
  StorageConflictError,
  StorageError,
} from "../errors.js";
import type { DatabaseSeed } from "../schema.js";
import {
  isSnapshotEnvelope,
  type SnapshotEnvelope,
  type StorageAdapter,
  type StoreAcknowledgement,
} from "../storage.js";

const defaultMaxBytes = 64 * 1024 * 1024;

interface DiskEnvelope<Seed extends DatabaseSeed> {
  readonly checksum: string;
  readonly snapshot: SnapshotEnvelope<Seed>;
}

interface LockRecord {
  readonly pid: number;
  readonly token: string;
}

export interface JsonFileAdapterOptions {
  readonly createDirectories?: boolean;
  /** Test instrumentation. Throw or terminate the process to simulate a named fault. */
  readonly faultInjector?: (point: JsonFileFaultPoint) => Promise<void> | void;
  readonly maxBytes?: number;
  readonly mode?: number;
}

export type JsonFileFaultPoint =
  | "after-directory-sync"
  | "after-file-sync"
  | "after-rename"
  | "after-temp-close"
  | "after-temp-open"
  | "after-write"
  | "before-temp-open";

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EPERM"
    );
  }
}

function parseLock(value: string): LockRecord | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object") return undefined;
    const record = parsed as Partial<LockRecord>;
    if (
      typeof record.pid !== "number" ||
      !Number.isSafeInteger(record.pid) ||
      typeof record.token !== "string" ||
      record.token.length === 0
    ) {
      return undefined;
    }
    return { pid: record.pid, token: record.token };
  } catch {
    return undefined;
  }
}

export class JsonFileAdapter<
  Seed extends DatabaseSeed,
> implements StorageAdapter<Seed> {
  readonly path: string;
  readonly #lockPath: string;
  readonly #createDirectories: boolean;
  readonly #faultInjector:
    ((point: JsonFileFaultPoint) => Promise<void> | void) | undefined;
  readonly #maxBytes: number;
  readonly #mode: number;
  #closed = false;
  #databaseId: string | undefined;
  #generation = 0;
  #loaded = false;
  #lock: FileHandle | undefined;
  #lockToken: string | undefined;

  constructor(path: string, options: JsonFileAdapterOptions = {}) {
    if (path.length === 0)
      throw new StorageError("Storage path must not be empty");
    this.path = resolve(path);
    this.#lockPath = `${this.path}.lock`;
    this.#createDirectories = options.createDirectories ?? false;
    this.#faultInjector = options.faultInjector;
    this.#maxBytes = options.maxBytes ?? defaultMaxBytes;
    this.#mode = options.mode ?? 0o600;
    if (!Number.isSafeInteger(this.#maxBytes) || this.#maxBytes <= 0) {
      throw new StorageError("maxBytes must be a positive safe integer");
    }
  }

  async load(): Promise<SnapshotEnvelope<Seed> | null> {
    this.#assertOpen();
    if (this.#loaded) {
      throw new StorageError(
        "This adapter instance has already loaded storage",
      );
    }
    await this.#acquireLock();
    this.#loaded = true;
    try {
      await this.#removeStaleTemps();
      const snapshot = await this.#readSnapshot();
      this.#generation = snapshot?.generation ?? 0;
      this.#databaseId = snapshot?.databaseId;
      return snapshot;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async store(
    snapshot: SnapshotEnvelope<Seed>,
    options: Readonly<{ expectedGeneration: number }>,
  ): Promise<StoreAcknowledgement> {
    this.#assertReady();
    if (
      options.expectedGeneration !== this.#generation ||
      snapshot.generation !== options.expectedGeneration + 1
    ) {
      throw new StorageConflictError();
    }
    if (
      this.#databaseId !== undefined &&
      snapshot.databaseId !== this.#databaseId
    ) {
      throw new StorageConflictError(
        "The database identity changed unexpectedly",
      );
    }

    const disk = await this.#readSnapshot();
    if (
      (disk?.generation ?? 0) !== this.#generation ||
      (disk !== null &&
        disk.databaseId !== (this.#databaseId ?? snapshot.databaseId))
    ) {
      throw new StorageConflictError(
        "The storage file was modified externally",
      );
    }

    const serialized = `${JSON.stringify({
      checksum: checksum(snapshot),
      snapshot,
    } satisfies DiskEnvelope<Seed>)}\n`;
    if (Buffer.byteLength(serialized) > this.#maxBytes) {
      throw new StorageError(
        "Serialized snapshot exceeds the configured byte limit",
      );
    }

    const temporaryPath = `${dirname(this.path)}/.${basename(this.path)}.${process.pid}.${randomUUID()}.tmp`;
    let temporary: FileHandle | undefined;
    try {
      await this.#fault("before-temp-open");
      temporary = await open(
        temporaryPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        this.#mode,
      );
      await this.#fault("after-temp-open");
      await temporary.writeFile(serialized, { encoding: "utf8" });
      await this.#fault("after-write");
      await temporary.sync();
      await this.#fault("after-file-sync");
      await temporary.close();
      temporary = undefined;
      await this.#fault("after-temp-close");
      await rename(temporaryPath, this.path);
      await this.#fault("after-rename");
      await this.#syncDirectory();
      await this.#fault("after-directory-sync");
    } catch (error) {
      await temporary?.close().catch(() => undefined);
      await unlink(temporaryPath).catch(() => undefined);
      if (
        error instanceof StorageError ||
        error instanceof StorageConflictError
      ) {
        throw error;
      }
      throw new StorageError(
        "Failed to atomically store the database snapshot",
        {
          cause: error,
        },
      );
    }

    this.#databaseId = snapshot.databaseId;
    this.#generation = snapshot.generation;
    return Object.freeze({
      databaseId: snapshot.databaseId,
      generation: snapshot.generation,
      revision: snapshot.revision,
    });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    const lock = this.#lock;
    this.#lock = undefined;
    await lock?.close().catch(() => undefined);
    if (this.#lockToken !== undefined) {
      try {
        const current = parseLock(await readFile(this.#lockPath, "utf8"));
        if (current?.token === this.#lockToken) await unlink(this.#lockPath);
      } catch (error) {
        if (!isMissing(error)) {
          throw new StorageError("Failed to release the database lock", {
            cause: error,
          });
        }
      }
    }
  }

  async #acquireLock(): Promise<void> {
    const directory = dirname(this.path);
    if (this.#createDirectories) {
      await mkdir(directory, { recursive: true, mode: 0o700 }).catch(
        (error: unknown) => {
          throw new StorageError(
            "Could not create the storage parent directory",
            {
              cause: error,
            },
          );
        },
      );
    }
    try {
      const info = await lstat(directory);
      if (!info.isDirectory())
        throw new StorageError("Storage parent is not a directory");
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("Storage parent directory is unavailable", {
        cause: error,
      });
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = randomUUID();
      try {
        const handle = await open(
          this.#lockPath,
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
          0o600,
        );
        await handle.writeFile(
          JSON.stringify({ pid: process.pid, token }),
          "utf8",
        );
        await handle.sync();
        this.#lock = handle;
        this.#lockToken = token;
        return;
      } catch (error) {
        if (!isAlreadyExists(error)) {
          throw new StorageError("Failed to acquire the database lock", {
            cause: error,
          });
        }
        const firstText = await readFile(this.#lockPath, "utf8").catch(
          () => undefined,
        );
        const owner =
          firstText === undefined ? undefined : parseLock(firstText);
        if (owner !== undefined && processIsAlive(owner.pid)) {
          throw new StorageConflictError(
            "The database is locked by another live process",
          );
        }
        const secondText = await readFile(this.#lockPath, "utf8").catch(
          () => undefined,
        );
        if (firstText === undefined || secondText !== firstText) continue;
        await unlink(this.#lockPath).catch(() => undefined);
      }
    }
    throw new StorageConflictError(
      "Could not safely recover the stale database lock",
    );
  }

  async #readSnapshot(): Promise<SnapshotEnvelope<Seed> | null> {
    try {
      const info = await lstat(this.path);
      if (info.isSymbolicLink() || !info.isFile()) {
        throw new CorruptStorageError(
          "Storage path must be a regular file, not a symlink",
        );
      }
      if (info.size > this.#maxBytes) {
        throw new CorruptStorageError(
          "Stored snapshot exceeds the configured byte limit",
        );
      }
      const bytes = await readFile(this.path);
      if (bytes.length > this.#maxBytes) {
        throw new CorruptStorageError(
          "Stored snapshot exceeds the configured byte limit",
        );
      }
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        throw new CorruptStorageError(
          "UTF-8 byte-order marks are not accepted",
        );
      }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed: unknown = JSON.parse(text);
      if (parsed === null || typeof parsed !== "object") {
        throw new CorruptStorageError("Stored snapshot envelope is malformed");
      }
      const envelope = parsed as Partial<DiskEnvelope<Seed>>;
      if (
        typeof envelope.checksum !== "string" ||
        !isSnapshotEnvelope(envelope.snapshot) ||
        checksum(envelope.snapshot) !== envelope.checksum
      ) {
        throw new CorruptStorageError(
          "Stored snapshot checksum or envelope is invalid",
        );
      }
      return envelope.snapshot;
    } catch (error) {
      if (isMissing(error)) return null;
      if (error instanceof CorruptStorageError) throw error;
      if (error instanceof SyntaxError || error instanceof TypeError) {
        throw new CorruptStorageError(
          "Stored snapshot is not valid UTF-8 JSON",
          {
            cause: error,
          },
        );
      }
      throw new StorageError("Failed to read the database snapshot", {
        cause: error,
      });
    }
  }

  async #removeStaleTemps(): Promise<void> {
    try {
      const directory = dirname(this.path);
      const prefix = `.${basename(this.path)}.`;
      const names = await readdir(directory);
      await Promise.all(
        names
          .filter((name) => name.startsWith(prefix) && name.endsWith(".tmp"))
          .map((name) => unlink(join(directory, name))),
      );
    } catch (error) {
      throw new StorageError("Failed to remove stale snapshot files", {
        cause: error,
      });
    }
  }

  async #syncDirectory(): Promise<void> {
    let directory: FileHandle | undefined;
    try {
      directory = await open(dirname(this.path), constants.O_RDONLY);
      await directory.sync();
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      if (code !== "EINVAL" && code !== "ENOTSUP" && code !== "EISDIR")
        throw error;
    } finally {
      await directory?.close();
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw new StorageError("The storage adapter is closed");
  }

  #assertReady(): void {
    this.#assertOpen();
    if (!this.#loaded || this.#lock === undefined) {
      throw new StorageError("load() must acquire storage before store()");
    }
  }

  async #fault(point: JsonFileFaultPoint): Promise<void> {
    await this.#faultInjector?.(point);
  }
}
