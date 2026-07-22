import { CorruptStorageError } from "../errors.js";

const whitespace = new Set([" ", "\n", "\r", "\t"]);
const numberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u;

/** Rejects duplicate object names before JSON.parse applies last-name-wins semantics. */
export function assertNoDuplicateJsonKeys(text: string): void {
  let index = 0;
  let nodes = 0;
  const fail = (message: string): never => {
    throw new SyntaxError(`${message} at character ${index}`);
  };
  const skipWhitespace = () => {
    while (whitespace.has(text[index] ?? "")) index += 1;
  };
  const parseString = (): string => {
    const start = index;
    if (text[index++] !== '"') fail("Expected a JSON string");
    while (index < text.length) {
      const character = text[index++];
      if (character === '"') {
        const decoded: unknown = JSON.parse(text.slice(start, index));
        if (typeof decoded === "string") return decoded;
        return fail("Invalid JSON string");
      }
      if (character === "\\") {
        const escape = text[index++];
        if (escape === "u") {
          const digits = text.slice(index, index + 4);
          if (!/^[\dA-Fa-f]{4}$/u.test(digits)) fail("Invalid Unicode escape");
          index += 4;
        } else if (!'"\\/bfnrt'.includes(escape ?? "")) {
          fail("Invalid string escape");
        }
      } else if (character === undefined || character.charCodeAt(0) < 0x20) {
        fail("Invalid string character");
      }
    }
    return fail("Unterminated JSON string");
  };
  const parseValue = (depth: number): void => {
    nodes += 1;
    if (nodes > 1_000_000)
      throw new CorruptStorageError("Stored JSON exceeds the node limit");
    if (depth > 128)
      throw new CorruptStorageError("Stored JSON exceeds the nesting limit");
    skipWhitespace();
    const character = text[index];
    if (character === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set<string>();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) {
          throw new CorruptStorageError(
            `Stored JSON contains duplicate object key ${JSON.stringify(key)}`,
          );
        }
        keys.add(key);
        skipWhitespace();
        if (text[index++] !== ":") fail("Expected a colon");
        parseValue(depth + 1);
        skipWhitespace();
        const delimiter = text[index++];
        if (delimiter === "}") return;
        if (delimiter !== ",") fail("Expected an object delimiter");
      }
      fail("Unterminated object");
    }
    if (character === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      while (index < text.length) {
        parseValue(depth + 1);
        skipWhitespace();
        const delimiter = text[index++];
        if (delimiter === "]") return;
        if (delimiter !== ",") fail("Expected an array delimiter");
      }
      fail("Unterminated array");
    }
    if (character === '"') {
      parseString();
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, index)) {
        index += literal.length;
        return;
      }
    }
    const number = numberPattern.exec(text.slice(index))?.[0];
    if (number !== undefined) {
      index += number.length;
      return;
    }
    fail("Invalid JSON value");
  };

  parseValue(0);
  skipWhitespace();
  if (index !== text.length) fail("Unexpected trailing JSON data");
}
