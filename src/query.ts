import { InvalidArgumentError, QueryValidationError } from "./errors.js";
import type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
  ReadonlyDeep,
} from "./json.js";
import { readPath, validatePath, type PropertyPath } from "./path.js";

export type ComparisonOperator =
  | "contains"
  | "endsWith"
  | "eq"
  | "gt"
  | "gte"
  | "in"
  | "lt"
  | "lte"
  | "ne"
  | "startsWith";

export interface ComparisonCondition<T extends JsonObject = JsonObject> {
  readonly op: ComparisonOperator;
  readonly path: PropertyPath;
  readonly value: JsonPrimitive | readonly JsonPrimitive[];
  readonly __document?: T;
}

export interface AndCondition<T extends JsonObject = JsonObject> {
  readonly conditions: readonly Where<T>[];
  readonly op: "and";
}

export interface OrCondition<T extends JsonObject = JsonObject> {
  readonly conditions: readonly Where<T>[];
  readonly op: "or";
}

export interface NotCondition<T extends JsonObject = JsonObject> {
  readonly condition: Where<T>;
  readonly op: "not";
}

export type Where<T extends JsonObject = JsonObject> =
  AndCondition<T> | ComparisonCondition<T> | NotCondition<T> | OrCondition<T>;

const localPredicateBrand: unique symbol = Symbol("NewtonDB.localPredicate");

export interface LocalPredicate<T extends JsonObject> {
  readonly [localPredicateBrand]: true;
  readonly test: (document: ReadonlyDeep<T>) => boolean;
}

/** Wraps process-local code that is deliberately excluded from serialized queries. */
export function localPredicate<T extends JsonObject>(
  test: (document: ReadonlyDeep<T>) => boolean,
): LocalPredicate<T> {
  if (typeof test !== "function") {
    throw new InvalidArgumentError("A local predicate must be a function");
  }
  return Object.freeze({ [localPredicateBrand]: true as const, test });
}

export type ScalarFields<T extends JsonObject> = {
  [Key in keyof T]-?: T[Key] extends JsonPrimitive ? Key : never;
}[keyof T] &
  string;

export type ScalarAt<
  T extends JsonObject,
  Key extends ScalarFields<T>,
> = Extract<T[Key], JsonPrimitive>;

export interface WhereBuilder<T extends JsonObject> {
  and(...conditions: readonly Where<T>[]): Where<T>;
  contains<Key extends ScalarFields<T>>(
    field: Key,
    value: ScalarAt<T, Key>,
  ): Where<T>;
  endsWith(field: ScalarFields<T>, value: string): Where<T>;
  eq<Key extends ScalarFields<T>>(
    field: Key,
    value: ScalarAt<T, Key>,
  ): Where<T>;
  gt<Key extends ScalarFields<T>>(
    field: Key,
    value: ScalarAt<T, Key>,
  ): Where<T>;
  gte<Key extends ScalarFields<T>>(
    field: Key,
    value: ScalarAt<T, Key>,
  ): Where<T>;
  in<Key extends ScalarFields<T>>(
    field: Key,
    values: readonly ScalarAt<T, Key>[],
  ): Where<T>;
  lt<Key extends ScalarFields<T>>(
    field: Key,
    value: ScalarAt<T, Key>,
  ): Where<T>;
  lte<Key extends ScalarFields<T>>(
    field: Key,
    value: ScalarAt<T, Key>,
  ): Where<T>;
  ne<Key extends ScalarFields<T>>(
    field: Key,
    value: ScalarAt<T, Key>,
  ): Where<T>;
  not(condition: Where<T>): Where<T>;
  or(...conditions: readonly Where<T>[]): Where<T>;
  startsWith(field: ScalarFields<T>, value: string): Where<T>;
}

function comparison<T extends JsonObject>(
  op: ComparisonOperator,
  field: string,
  value: JsonPrimitive | readonly JsonPrimitive[],
): Where<T> {
  return Object.freeze({
    op,
    path: validatePath([field]),
    value,
  });
}

export function where<T extends JsonObject>(): WhereBuilder<T> {
  const builder: WhereBuilder<T> = {
    and: (...conditions) =>
      Object.freeze({ conditions: Object.freeze([...conditions]), op: "and" }),
    contains: (field, value) => comparison<T>("contains", field, value),
    endsWith: (field, value) => comparison<T>("endsWith", field, value),
    eq: (field, value) => comparison<T>("eq", field, value),
    gt: (field, value) => comparison<T>("gt", field, value),
    gte: (field, value) => comparison<T>("gte", field, value),
    in: (field, values) =>
      comparison<T>("in", field, Object.freeze([...values])),
    lt: (field, value) => comparison<T>("lt", field, value),
    lte: (field, value) => comparison<T>("lte", field, value),
    ne: (field, value) => comparison<T>("ne", field, value),
    not: (condition) => Object.freeze({ condition, op: "not" }),
    or: (...conditions) =>
      Object.freeze({ conditions: Object.freeze([...conditions]), op: "or" }),
    startsWith: (field, value) => comparison<T>("startsWith", field, value),
  };
  return Object.freeze(builder);
}

export interface QueryLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxPathTokens: number;
  readonly maxScalarBytes: number;
  readonly maxSetValues: number;
  readonly maxTotalScalarBytes: number;
}

export const defaultQueryLimits: QueryLimits = Object.freeze({
  maxDepth: 32,
  maxNodes: 1_000,
  maxPathTokens: 32,
  maxScalarBytes: 262_144,
  maxSetValues: 10_000,
  maxTotalScalarBytes: 1_048_576,
});

const comparisonOperators = new Set<ComparisonOperator>([
  "contains",
  "endsWith",
  "eq",
  "gt",
  "gte",
  "in",
  "lt",
  "lte",
  "ne",
  "startsWith",
]);

function isPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

export function parseWhere<T extends JsonObject>(
  input: unknown,
  limits: QueryLimits = defaultQueryLimits,
): Where<T> {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new InvalidArgumentError(
        `Query limit ${name} must be a positive safe integer`,
      );
    }
  }
  let nodes = 0;
  let scalarBytes = 0;
  const consumeScalar = (value: JsonPrimitive | string, location: string) => {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (bytes > limits.maxScalarBytes) {
      throw new QueryValidationError("SCALAR_SIZE_LIMIT", location);
    }
    scalarBytes += bytes;
    if (scalarBytes > limits.maxTotalScalarBytes) {
      throw new QueryValidationError("SCALAR_SIZE_LIMIT", location);
    }
  };
  const visit = (
    candidate: unknown,
    depth: number,
    location: string,
  ): Where<T> => {
    nodes += 1;
    if (nodes > limits.maxNodes)
      throw new QueryValidationError("NODE_LIMIT", location);
    if (depth > limits.maxDepth)
      throw new QueryValidationError("DEPTH_LIMIT", location);
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      throw new QueryValidationError("INVALID_NODE", location);
    }
    const descriptor = Object.getOwnPropertyDescriptor(candidate, "op");
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      throw new QueryValidationError("INVALID_OPERATOR", location);
    }
    const op = descriptor.value;
    const keys = Object.keys(Object.getOwnPropertyDescriptors(candidate));
    const allowedKeys =
      op === "and" || op === "or"
        ? ["conditions", "op"]
        : op === "not"
          ? ["condition", "op"]
          : ["op", "path", "value"];
    if (keys.some((key) => !allowedKeys.includes(key))) {
      throw new QueryValidationError("INVALID_NODE", location);
    }
    if (op === "and" || op === "or") {
      const conditions = Object.getOwnPropertyDescriptor(
        candidate,
        "conditions",
      )?.value as unknown;
      if (!Array.isArray(conditions) || conditions.length === 0) {
        throw new QueryValidationError(
          "INVALID_BOOLEAN",
          `${location}/conditions`,
        );
      }
      const parsed = conditions.map((condition, index) =>
        visit(condition, depth + 1, `${location}/conditions/${index}`),
      );
      return Object.freeze({
        conditions: Object.freeze(parsed),
        op,
      });
    }
    if (op === "not") {
      const condition = Object.getOwnPropertyDescriptor(candidate, "condition")
        ?.value as unknown;
      return Object.freeze({
        condition: visit(condition, depth + 1, `${location}/condition`),
        op,
      });
    }
    if (!comparisonOperators.has(op as ComparisonOperator)) {
      throw new QueryValidationError("INVALID_OPERATOR", location);
    }
    let path: PropertyPath;
    try {
      path = validatePath(
        Object.getOwnPropertyDescriptor(candidate, "path")?.value,
        limits.maxPathTokens,
      );
    } catch (error) {
      throw new QueryValidationError("INVALID_PATH", `${location}/path`, {
        cause: error,
      });
    }
    for (const [index, token] of path.entries()) {
      if (typeof token === "string") {
        consumeScalar(token, `${location}/path/${index}`);
      }
    }
    const value = Object.getOwnPropertyDescriptor(candidate, "value")
      ?.value as unknown;
    if (op === "in") {
      if (
        !Array.isArray(value) ||
        value.length > limits.maxSetValues ||
        !value.every(isPrimitive)
      ) {
        throw new QueryValidationError("INVALID_VALUE", `${location}/value`);
      }
      for (const [index, item] of value.entries()) {
        consumeScalar(item, `${location}/value/${index}`);
      }
      return Object.freeze({
        op,
        path,
        value: Object.freeze([...value]),
      });
    }
    if (!isPrimitive(value))
      throw new QueryValidationError("INVALID_VALUE", `${location}/value`);
    consumeScalar(value, `${location}/value`);
    if (
      (op === "startsWith" || op === "endsWith") &&
      typeof value !== "string"
    ) {
      throw new QueryValidationError("INVALID_VALUE", `${location}/value`);
    }
    return Object.freeze({ op, path, value }) as Where<T>;
  };
  return visit(input, 0, "");
}

function samePrimitive(
  left: JsonValue | undefined,
  right: JsonPrimitive,
): boolean {
  return left === right;
}

function orderedCompare(
  source: JsonValue | undefined,
  value: JsonPrimitive,
  compare: (left: number | string, right: number | string) => boolean,
): boolean {
  if (
    (typeof source !== "number" && typeof source !== "string") ||
    typeof source !== typeof value
  ) {
    return false;
  }
  return compare(source, value as number | string);
}

export function compileWhere<T extends JsonObject>(
  input: unknown,
  limits: QueryLimits = defaultQueryLimits,
): {
  readonly ast: Where<T>;
  readonly test: (document: ReadonlyDeep<T>) => boolean;
} {
  const ast = parseWhere<T>(input, limits);
  const compile = (
    condition: Where<T>,
  ): ((document: ReadonlyDeep<T>) => boolean) => {
    if (condition.op === "and") {
      const children = condition.conditions.map(compile);
      return (document) => children.every((test) => test(document));
    }
    if (condition.op === "or") {
      const children = condition.conditions.map(compile);
      return (document) => children.some((test) => test(document));
    }
    if (condition.op === "not") {
      const child = compile(condition.condition);
      return (document) => !child(document);
    }
    const { op, path, value } = condition;
    if (op === "in") {
      const values = new Set(value as readonly JsonPrimitive[]);
      return (document) =>
        values.has(readPath(document, path) as JsonPrimitive);
    }
    return (document) => {
      const source = readPath(document, path);
      switch (op) {
        case "eq":
          return samePrimitive(source, value as JsonPrimitive);
        case "ne":
          return !samePrimitive(source, value as JsonPrimitive);
        case "lt":
          return orderedCompare(
            source,
            value as JsonPrimitive,
            (left, right) => left < right,
          );
        case "lte":
          return orderedCompare(
            source,
            value as JsonPrimitive,
            (left, right) => left <= right,
          );
        case "gt":
          return orderedCompare(
            source,
            value as JsonPrimitive,
            (left, right) => left > right,
          );
        case "gte":
          return orderedCompare(
            source,
            value as JsonPrimitive,
            (left, right) => left >= right,
          );
        case "contains":
          return typeof source === "string"
            ? typeof value === "string" && source.includes(value)
            : Array.isArray(source) && source.includes(value);
        case "startsWith":
          return (
            typeof source === "string" && source.startsWith(value as string)
          );
        case "endsWith":
          return typeof source === "string" && source.endsWith(value as string);
      }
    };
  };
  return Object.freeze({ ast, test: compile(ast) });
}

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidArgumentError(
      `${label} must be a non-negative safe integer`,
    );
  }
}
