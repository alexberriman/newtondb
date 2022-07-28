import { isArray } from "./is-array";
import { isPopulatedArray } from "./is-populated-array";

export function isMultiDimensionalArray<T>(value: unknown): value is T[][] {
  return isPopulatedArray(value) && isArray(value[0]);
}
