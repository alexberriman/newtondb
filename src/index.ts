export {
  Collection,
  Database,
  Query,
  Transaction,
  TransactionCollection,
  type CommitReceipt,
  type DatabaseOptions,
  type QueryPlan,
} from "./database.js";
export {
  ClosedError,
  ConflictError,
  DuplicateKeyError,
  DuplicateUniqueIndexError,
  ImmutablePrimaryKeyError,
  InvalidArgumentError,
  NewtonError,
  NotFoundError,
  QueryValidationError,
  SchemaValidationError,
  TransactionCallbackError,
  TransactionStateError,
  type NewtonErrorCode,
  type QueryValidationIssue,
} from "./errors.js";
export type {
  Change,
  ChangeBatch,
  ChangeListener,
  ChangeOperation,
} from "./events.js";
export {
  JsonValidationError,
  cloneAndFreezeJsonObject,
  defaultJsonLimits,
  type JsonLimits,
  type JsonObject,
  type JsonPrimitive,
  type JsonValidationIssue,
  type JsonValue,
  type ReadonlyDeep,
} from "./json.js";
export { collectionSchema } from "./schema.js";
export type {
  CollectionSchema,
  DatabaseSchema,
  DatabaseSeed,
  DocumentOf,
  PrimaryKey,
  PrimaryKeyField,
  SecondaryIndex,
  WidenJson,
  WidenSeed,
} from "./schema.js";
export { readPath, samePath, validatePath } from "./path.js";
export type { PathToken, PropertyPath } from "./path.js";
export {
  assertNonNegativeInteger,
  compileWhere,
  defaultQueryLimits,
  parseWhere,
  where,
  type AndCondition,
  type ComparisonCondition,
  type ComparisonOperator,
  type NotCondition,
  type OrCondition,
  type QueryLimits,
  type Where,
  type WhereBuilder,
} from "./query.js";
