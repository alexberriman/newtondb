import { isObject } from "./is-object";

export function isPartial<T>(
  candidate: unknown,
  target: T
): candidate is Partial<T> {
  return (
    isObject(target) &&
    isObject(candidate) &&
    Object.entries(candidate).every(([key, value]) => target[key] === value)
  );
}
