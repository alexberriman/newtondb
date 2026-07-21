import { InvalidArgumentError } from "./errors.js";
import type { JsonValue } from "./json.js";

export type PathToken = number | string;
export type PropertyPath = readonly [string, ...PathToken[]];

function encodePointerToken(token: PathToken): string {
  if (typeof token === "number") return `~n${token}`;
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

function decodePointerToken(token: string): PathToken {
  const numeric = /^~n(0|[1-9]\d*)$/u.exec(token);
  if (numeric !== null) {
    const value = Number(numeric[1]);
    if (Number.isSafeInteger(value)) return value;
    throw new InvalidArgumentError(
      "Numeric path token exceeds the safe-integer range",
    );
  }
  if (/~(?![01])/u.test(token)) {
    throw new InvalidArgumentError(
      "Property pointer contains an invalid escape",
    );
  }
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

/** Formats a typed property path using JSON Pointer escapes plus `~n` numeric tokens. */
export function formatPath(path: PropertyPath): string {
  return `/${validatePath(path).map(encodePointerToken).join("/")}`;
}

/** Parses the lossless typed-pointer representation produced by {@link formatPath}. */
export function parsePath(pointer: string, maxTokens = 32): PropertyPath {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    throw new InvalidArgumentError("A property pointer must start with /");
  }
  return validatePath(
    pointer.slice(1).split("/").map(decodePointerToken),
    maxTokens,
  );
}

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
  for (const [index, token] of path.entries()) {
    if (typeof token === "string") {
      output.push(token);
      continue;
    }
    if (
      typeof token === "number" &&
      Number.isSafeInteger(token) &&
      token >= 0 &&
      index > 0
    ) {
      output.push(token);
      continue;
    }
    throw new InvalidArgumentError(
      "The first path token must be a string; later tokens must be strings or non-negative safe integers",
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
