import { isArray } from "./is-array";

export function isSingleArray<T, Y>(value: T[] | Y): value is [T] {
  return isArray(value) && value.length === 1;
}
