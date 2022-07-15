import { isArray, isDefined } from "./types";

export function shallowEqual(left: unknown[], right: unknown[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

export function flatten<T>(input: unknown[]): T[] {
  return input.reduce((flat: T[], value) => {
    if (!isArray(value)) {
      return [...flat, value as T];
    }

    return [...flat, ...flatten(value)] as T[];
  }, []);
}

export function findLast<T>(
  items: T[],
  predicate: (item: T) => boolean
): T | undefined {
  for (let index = items.length - 1; index >= 0; index--) {
    if (predicate(items[index])) {
      return items[index];
    }
  }
}

export function keyArrayBy<T>(
  input: T[],
  keyAttribute: string
): Record<string, T[]> {
  return input.reduce((obj: Record<string, T[]>, item) => {
    const $item = item as Record<string, unknown>;
    if (!isDefined($item[keyAttribute])) {
      return obj;
    }

    const key = $item[keyAttribute] as unknown as string;
    const existing = obj[key] ?? [];

    return {
      ...obj,
      [key]: [...existing, item],
    };
  }, {});
}
