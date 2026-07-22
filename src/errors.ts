export type NewtonErrorCode =
  | "ERR_CLOSED"
  | "ERR_CONFLICT"
  | "ERR_CORRUPT_STORAGE"
  | "ERR_DUPLICATE_KEY"
  | "ERR_DUPLICATE_UNIQUE_INDEX"
  | "ERR_IMMUTABLE_PRIMARY_KEY"
  | "ERR_INVARIANT"
  | "ERR_INVALID_ARGUMENT"
  | "ERR_INVALID_JSON_DOCUMENT"
  | "ERR_NOT_FOUND"
  | "ERR_PERSISTENCE"
  | "ERR_QUERY_VALIDATION"
  | "ERR_SCHEMA_VALIDATION"
  | "ERR_STORAGE"
  | "ERR_STORAGE_CONFLICT"
  | "ERR_TRANSACTION_CALLBACK"
  | "ERR_TRANSACTION_STATE";

export class NewtonError extends Error {
  constructor(
    readonly code: NewtonErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }

  toJSON(): Readonly<{ code: NewtonErrorCode; message: string; name: string }> {
    return Object.freeze({
      code: this.code,
      message: this.message,
      name: this.name,
    });
  }
}

export class ClosedError extends NewtonError {
  constructor() {
    super("ERR_CLOSED", "The database is closed");
  }
}

export class ConflictError extends NewtonError {
  constructor(readonly collections: readonly string[]) {
    super(
      "ERR_CONFLICT",
      "The transaction conflicts with a newer committed revision",
    );
  }
}

export class CorruptStorageError extends NewtonError {
  constructor(message: string, options?: ErrorOptions) {
    super("ERR_CORRUPT_STORAGE", message, options);
  }
}

export class DuplicateKeyError extends NewtonError {
  constructor(
    readonly collection: string,
    readonly key: number | string,
  ) {
    super(
      "ERR_DUPLICATE_KEY",
      `Collection ${collection} already contains the primary key`,
    );
  }
}

export class DuplicateUniqueIndexError extends NewtonError {
  constructor(
    readonly collection: string,
    readonly index: string,
  ) {
    super(
      "ERR_DUPLICATE_UNIQUE_INDEX",
      `Unique index ${collection}.${index} contains a duplicate value`,
    );
  }
}

export class ImmutablePrimaryKeyError extends NewtonError {
  constructor(readonly collection: string) {
    super(
      "ERR_IMMUTABLE_PRIMARY_KEY",
      `The primary key for ${collection} is immutable`,
    );
  }
}

export class InvariantViolationError extends NewtonError {
  constructor(message: string) {
    super("ERR_INVARIANT", message);
  }
}

export class InvalidArgumentError extends NewtonError {
  constructor(message: string) {
    super("ERR_INVALID_ARGUMENT", message);
  }
}

export class NotFoundError extends NewtonError {
  constructor(
    readonly collection: string,
    readonly key: number | string,
  ) {
    super(
      "ERR_NOT_FOUND",
      `No document exists for the requested primary key in ${collection}`,
    );
  }
}

export type QueryValidationIssue =
  | "CANDIDATE_LIMIT"
  | "DEPTH_LIMIT"
  | "INVALID_BOOLEAN"
  | "INVALID_NODE"
  | "INVALID_OPERATOR"
  | "INVALID_PATH"
  | "INVALID_VALUE"
  | "NODE_LIMIT"
  | "RESULT_LIMIT"
  | "SCALAR_SIZE_LIMIT"
  | "SORT_LIMIT";

export class QueryValidationError extends NewtonError {
  constructor(
    readonly issue: QueryValidationIssue,
    readonly location: string,
    options?: ErrorOptions,
  ) {
    super(
      "ERR_QUERY_VALIDATION",
      `Invalid query (${issue}) at ${location || "/"}`,
      options,
    );
  }
}

export interface CommittedReceiptMetadata {
  readonly affected: number;
  readonly databaseId: string;
  readonly durability: "memory" | "persisted";
  readonly generatedKeys: readonly Readonly<{
    readonly collection: string;
    readonly primaryKey: string;
  }>[];
  readonly revision: number;
  readonly transactionId: string;
}

export class PersistenceError extends NewtonError {
  readonly receipt: Readonly<CommittedReceiptMetadata>;

  constructor(receipt: CommittedReceiptMetadata, options?: ErrorOptions) {
    super(
      "ERR_PERSISTENCE",
      `Revision ${receipt.revision} committed in memory but could not be persisted`,
      options,
    );
    this.receipt = Object.freeze({ ...receipt });
  }
}

export class StorageError extends NewtonError {
  constructor(message: string, options?: ErrorOptions) {
    super("ERR_STORAGE", message, options);
  }
}

export class StorageConflictError extends NewtonError {
  constructor(message = "The storage generation changed unexpectedly") {
    super("ERR_STORAGE_CONFLICT", message);
  }
}

export class SchemaValidationError extends NewtonError {
  constructor(
    readonly collection: string,
    options?: ErrorOptions,
  ) {
    super(
      "ERR_SCHEMA_VALIDATION",
      `Schema validation failed for ${collection}`,
      options,
    );
  }
}

export class TransactionCallbackError extends NewtonError {
  constructor(message: string) {
    super("ERR_TRANSACTION_CALLBACK", message);
  }
}

export class TransactionStateError extends NewtonError {
  constructor(message: string) {
    super("ERR_TRANSACTION_STATE", message);
  }
}
