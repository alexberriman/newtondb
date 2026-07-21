import { InvalidArgumentError } from "./errors.js";
import type { JsonObject, JsonPrimitive, ReadonlyDeep } from "./json.js";
import type { CollectionSchema, PrimaryKey } from "./schema.js";

export function encodeKey(key: PrimaryKey): string {
  if (typeof key === "string") {
    if (key.length === 0)
      throw new InvalidArgumentError("Primary keys cannot be empty strings");
    return `s:${key.length}:${key}`;
  }
  if (!Number.isSafeInteger(key)) {
    throw new InvalidArgumentError(
      "Numeric primary keys must be safe integers",
    );
  }
  return `n:${key}`;
}

export function encodeIndexValue(value: JsonPrimitive): string {
  if (value === null) return "z:";
  if (typeof value === "boolean") return value ? "b:1" : "b:0";
  if (typeof value === "string") return `s:${value.length}:${value}`;
  if (!Number.isFinite(value))
    throw new InvalidArgumentError("Index numbers must be finite");
  return `n:${Object.is(value, -0) ? "-0" : value}`;
}

export function documentKey<T extends JsonObject>(
  document: ReadonlyDeep<T>,
  schema: CollectionSchema<T>,
): PrimaryKey {
  const value = document[schema.primaryKey] as unknown;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new InvalidArgumentError(
      "A primary key must be a non-empty string or safe integer",
    );
  }
  encodeKey(value);
  return value;
}
