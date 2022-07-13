import { isArray, isObject } from "./types";

export function objectSubset<T, K extends keyof T>(
  object: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce(
    (subset, key) => ({ ...subset, [key]: object[key] }),
    {}
  ) as Pick<T, K>;
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

export function keyBy<T>(input: T[], keyAttribute: string): Record<string, T> {
  return input.reduce(
    (obj, item) => ({
      ...obj,
      [(item as Record<string, unknown>)[keyAttribute] as unknown as string]:
        item,
    }),
    {}
  );
}
