import { asArray, isDefined } from "../utils/types";

type BaseOperation = { path: string };

export type MoveCopyOperation = BaseOperation & {
  op: "move" | "copy";
  from: string;
};

export type RemoveOperation = BaseOperation & { op: "remove" };

export type TestAddReplaceOperation = BaseOperation & {
  op: "test" | "add" | "replace";
  value: string | number | boolean | object;
};

export type PatchOperation =
  | MoveCopyOperation
  | RemoveOperation
  | TestAddReplaceOperation;

export type Patch = PatchOperation[];

function unescape(path: string) {
  return path.replaceAll("~1", "/").replaceAll("~0", "~");
}

function escape(path: string) {
  return path.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function toTokens(path: string) {
  if (!path.startsWith("/") && !path.startsWith("#/")) {
    throw new Error(`Invalid path: ${path}`);
  }

  const [, ...parts] = path.split("/");

  return parts.map((part) => unescape(part));
}

export function toPointer(
  path: string | number | (string | number)[],
  ...extraPaths: (string | number)[]
) {
  const paths = [...asArray(path), ...extraPaths];

  return `/${paths.map((path) => escape(path.toString())).join("/")}`;
}

// compares a partial object to the original to determine which properties
// need to be added and updated.
export function createUpdateOperations<T>(
  original: T,
  update: Partial<T>,
  prefix?: string | number | (string | number)[]
) {
  return Object.entries(update)
    .filter(([key, value]) => original[key as keyof T] !== value)
    .map(([key, value]) => ({
      op: isDefined(original[key as keyof T]) ? "replace" : "add",
      value,
      path: `${prefix ? toPointer(prefix) : ""}${toPointer(key)}`,
    })) as unknown as TestAddReplaceOperation[];
}
