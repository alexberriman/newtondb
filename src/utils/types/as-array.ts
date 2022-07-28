import { isArray } from "./is-array";
import { isNotNullOrUndefined } from "./is-not-null-or-undefined";

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!isNotNullOrUndefined(value)) {
    return [];
  }

  return isArray(value) ? value : [value];
}
