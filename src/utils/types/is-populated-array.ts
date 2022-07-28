import { isArray } from "./is-array";

export function isPopulatedArray<T, Y>(value: T[] | Y): value is T[] {
  return isArray(value) && value.length > 0;
}
