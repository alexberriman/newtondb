import { isArray } from "./is-array";

export function isSingular<T>(value: unknown): value is T {
  return !isArray(value);
}
