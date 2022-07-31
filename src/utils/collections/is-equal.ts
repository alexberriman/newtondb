import { isArray, isObject, isScalar } from "../types";

export function isEqual(left: unknown, right: unknown): boolean {
  if (isScalar(left) && isScalar(right)) {
    return left === right;
  }

  if (isArray(left) && isArray(right)) {
    return left.every((value, i) => isEqual(value, right[i]));
  }

  if (isObject(left) && isObject(right)) {
    return Object.entries(left).every(([key, value]) =>
      isEqual(value, right[key])
    );
  }

  return false;
}
