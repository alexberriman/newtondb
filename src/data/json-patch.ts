import { createPatch as createRfcPatch } from "rfc6902";
import { asArray } from "../utils/types";

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

export function createPatch(
  left: unknown,
  right: unknown,
  prefix?: string | number | (string | number)[]
) {
  return withPrefix(createRfcPatch(left, right), prefix) as Patch;
}

// compares a partial object to the original to determine which properties
// need to be added and updated.
export function createPartialPatch(
  original: object,
  update: object,
  prefix?: string | number | (string | number)[]
) {
  return withPrefix(
    createPatch(original, {
      ...original,
      ...update,
    }),
    prefix
  ) as Patch;
}

export function withPrefix(
  patch: Patch,
  prefix?: string | number | (string | number)[]
) {
  if (!prefix) {
    return patch;
  }

  return patch.map((operation) => ({
    ...operation,
    path: `${prefix ? toPointer(prefix) : ""}${operation.path}`,
  }));
}
