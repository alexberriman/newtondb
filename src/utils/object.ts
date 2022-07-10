import { isArray, isObject } from "./types";

export function objectSubset<T extends Record<string, unknown>>(
  object: Record<string, unknown>,
  keys: string[]
): Partial<T> {
  return keys.reduce((subset, key) => ({ ...subset, [key]: object[key] }), {});
}

export function dot(object: Record<string, unknown>, path: string) {
  return path.split(".").reduce((value: unknown, accessor) => {
    if (isObject(value)) {
      return value[accessor];
    }

    if (isArray(value)) {
      return value[Number(accessor)];
    }

    return undefined;
  }, object);
}
