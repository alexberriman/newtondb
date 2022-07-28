import { isDefined } from "./is-defined";
import { isNotNull } from "./is-not-null";

export function isNotNullOrUndefined<T>(
  value: T | null | undefined
): value is T {
  return isDefined(value) && isNotNull(value);
}
