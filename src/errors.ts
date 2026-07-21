export type NewtonErrorCode =
  | "ERR_CLOSED"
  | "ERR_CONFLICT"
  | "ERR_DUPLICATE_KEY"
  | "ERR_IMMUTABLE_PRIMARY_KEY"
  | "ERR_INVALID_ARGUMENT"
  | "ERR_INVALID_JSON_DOCUMENT"
  | "ERR_NOT_FOUND"
  | "ERR_SCHEMA_VALIDATION"
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

export class ImmutablePrimaryKeyError extends NewtonError {
  constructor(readonly collection: string) {
    super(
      "ERR_IMMUTABLE_PRIMARY_KEY",
      `The primary key for ${collection} is immutable`,
    );
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
