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
