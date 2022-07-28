import { shallowEqual } from "../arrays";
import { isArray } from "./is-array";

export function isObjectOfProperties<T>(
  object: unknown,
  properties: string[]
): object is T {
  return (
    object !== null &&
    typeof object === "object" &&
    !isArray(object) &&
    shallowEqual(Object.keys(object), properties)
  );
}
