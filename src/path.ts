import { InvalidArgumentError } from "./errors.js";
import type { JsonValue } from "./json.js";

export type PathToken = number | string;
export type PropertyPath = readonly [string, ...PathToken[]];

export function readPath(
  value: unknown,
  path: PropertyPath,
): JsonValue | undefined {
  let current: unknown = value;
  for (const token of path) {
    if (typeof token === "number") {
      if (!Array.isArray(current) || !Number.isSafeInteger(token) || token < 0)
        return undefined;
      current = current[token];
      continue;
    }
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    )
      return undefined;
    if (!Object.hasOwn(current, token)) return undefined;
    current = Object.getOwnPropertyDescriptor(current, token)?.value;
  }
  return current as JsonValue | undefined;
}

export function validatePath(path: unknown, maxTokens = 32): PropertyPath {
  if (!Array.isArray(path) || path.length === 0 || path.length > maxTokens) {
    throw new InvalidArgumentError(
      `A property path must contain 1-${maxTokens} tokens`,
    );
  }
  const output: PathToken[] = [];
  for (const token of path) {
    if (typeof token === "string" && token.length > 0) {
      output.push(token);
      continue;
    }
    if (
      typeof token === "number" &&
      Number.isSafeInteger(token) &&
      token >= 0
    ) {
      output.push(token);
      continue;
    }
    throw new InvalidArgumentError(
      "Path tokens must be non-empty strings or non-negative safe integers",
    );
  }
  return Object.freeze(output) as PropertyPath;
}

export function samePath(left: PropertyPath, right: PropertyPath): boolean {
  return (
    left.length === right.length &&
    left.every((token, index) => token === right[index])
  );
}
