import { shallowEqual } from "../arrays";
import { isObject } from "./is-object";

export function isObjectOfProperties<T>(
  object: unknown,
  properties: string[]
): object is T {
  return (
    object !== null &&
    isObject(object) &&
    shallowEqual(Object.keys(object), properties)
  );
}
