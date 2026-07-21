export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type ReadonlyDeep<T> = T extends JsonPrimitive
  ? T
  : T extends readonly (infer Item)[]
    ? readonly ReadonlyDeep<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: ReadonlyDeep<T[Key]> }
      : never;

export interface JsonLimits {
  readonly maxDepth: number;
  readonly maxDocumentBytes: number;
  readonly maxNodes: number;
  readonly maxStringBytes: number;
}

export const defaultJsonLimits: JsonLimits = Object.freeze({
  maxDepth: 64,
  maxDocumentBytes: 1_048_576,
  maxNodes: 100_000,
  maxStringBytes: 262_144,
});

export interface JsonValidationIssue {
  readonly code:
    | "ACCESSOR"
    | "CYCLE"
    | "DEPTH_LIMIT"
    | "DOCUMENT_SIZE_LIMIT"
    | "INVALID_NUMBER"
    | "INVALID_PROTOTYPE"
    | "NODE_LIMIT"
    | "NOT_OBJECT"
    | "SPARSE_ARRAY"
    | "STRING_SIZE_LIMIT"
    | "UNSUPPORTED_VALUE";
  readonly path: readonly (number | string)[];
  readonly message: string;
}

export class JsonValidationError extends TypeError {
  readonly code = "ERR_INVALID_JSON_DOCUMENT";
  readonly issue: Readonly<JsonValidationIssue>;

  constructor(issue: JsonValidationIssue) {
    super(`${issue.message} at ${formatPath(issue.path)}`);
    this.name = "JsonValidationError";
    this.issue = Object.freeze({
      ...issue,
      path: Object.freeze([...issue.path]),
    });
  }
}

const textEncoder = new TextEncoder();

function formatPath(path: readonly (number | string)[]): string {
  if (path.length === 0) return "/";
  return path
    .map(
      (token) =>
        `/${String(token).replaceAll("~", "~0").replaceAll("/", "~1")}`,
    )
    .join("");
}

function fail(
  code: JsonValidationIssue["code"],
  path: readonly (number | string)[],
  message: string,
): never {
  throw new JsonValidationError({ code, message, path });
}

export function cloneAndFreezeJsonObject<T extends JsonObject>(
  input: T,
  limits: JsonLimits = defaultJsonLimits,
): ReadonlyDeep<T> {
  const candidate: unknown = input;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    fail("NOT_OBJECT", [], "A document must be a plain JSON object");
  }

  const seen = new Set<object>();
  let nodes = 0;
  let bytes = 2;

  const visit = (
    value: unknown,
    path: readonly (number | string)[],
    depth: number,
  ): JsonValue => {
    nodes += 1;
    if (nodes > limits.maxNodes) {
      fail("NODE_LIMIT", path, `Document exceeds ${limits.maxNodes} values`);
    }
    if (depth > limits.maxDepth) {
      fail("DEPTH_LIMIT", path, `Document exceeds depth ${limits.maxDepth}`);
    }

    if (value === null || typeof value === "boolean") {
      bytes += value === null ? 4 : value ? 4 : 5;
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        fail("INVALID_NUMBER", path, "Numbers must be finite");
      }
      bytes += String(value).length;
      return value;
    }
    if (typeof value === "string") {
      const stringBytes = textEncoder.encode(value).byteLength;
      if (stringBytes > limits.maxStringBytes) {
        fail(
          "STRING_SIZE_LIMIT",
          path,
          `String exceeds ${limits.maxStringBytes} bytes`,
        );
      }
      bytes += stringBytes + 2;
      return value;
    }
    if (typeof value !== "object") {
      fail("UNSUPPORTED_VALUE", path, `Unsupported ${typeof value} value`);
    }
    if (seen.has(value)) fail("CYCLE", path, "Cyclic values are not JSON");
    seen.add(value);

    if (Array.isArray(value)) {
      const output: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          fail(
            "SPARSE_ARRAY",
            [...path, index],
            "Sparse arrays are not supported",
          );
        }
        output.push(visit(value[index], [...path, index], depth + 1));
        bytes += 1;
      }
      seen.delete(value);
      if (bytes > limits.maxDocumentBytes) {
        fail(
          "DOCUMENT_SIZE_LIMIT",
          path,
          `Document exceeds ${limits.maxDocumentBytes} bytes`,
        );
      }
      return Object.freeze(output);
    }

    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      fail("INVALID_PROTOTYPE", path, "Only plain objects are supported");
    }

    const output: JsonObject = Object.create(null) as JsonObject;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      if (descriptor === undefined) continue;
      if (!("value" in descriptor)) {
        fail("ACCESSOR", [...path, key], "Accessors are not supported");
      }
      const keyBytes = textEncoder.encode(key).byteLength;
      if (keyBytes > limits.maxStringBytes) {
        fail(
          "STRING_SIZE_LIMIT",
          [...path, key],
          `Property name exceeds ${limits.maxStringBytes} bytes`,
        );
      }
      Object.defineProperty(output, key, {
        configurable: false,
        enumerable: true,
        value: visit(descriptor.value, [...path, key], depth + 1),
        writable: false,
      });
      bytes += keyBytes + 3;
    }
    seen.delete(value);
    if (bytes > limits.maxDocumentBytes) {
      fail(
        "DOCUMENT_SIZE_LIMIT",
        path,
        `Document exceeds ${limits.maxDocumentBytes} bytes`,
      );
    }
    return Object.freeze(output);
  };

  return visit(input, [], 0) as ReadonlyDeep<T>;
}

export function detachedFrozen<T extends JsonObject>(
  value: ReadonlyDeep<T>,
): ReadonlyDeep<T> {
  return cloneAndFreezeJsonObject(value as T);
}
