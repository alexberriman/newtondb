import { shallowEqual } from "./array";

export function isUndefined<T>(value: T | undefined): value is undefined {
  return value === undefined;
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isNull<T>(value: T | null): value is null {
  return value === null;
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isNotNullOrUndefined<T>(
  value: T | null | undefined
): value is T {
  return isDefined(value) && isNotNull(value);
}

export function isScalar(value: unknown): value is string | number | boolean {
  return ["number", "string", "boolean"].includes(typeof value);
}

export function isSingleArray<T, Y>(value: T[] | Y): value is [T] {
  return isArray(value) && value.length === 1;
}

export function isPopulatedArray<T, Y>(value: T[] | Y): value is T[] {
  return isArray(value) && value.length > 0;
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isNumeric(value: unknown) {
  return (
    typeof value === "number" ||
    (typeof value === "string" && parseInt(value, 10).toString() === value)
  );
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && !Array.isArray(value);
}

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

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isSingular<T>(value: unknown): value is T {
  return !isArray(value);
}

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!isNotNullOrUndefined(value)) {
    return [];
  }

  return isArray(value) ? value : [value];
}

export function objectOfProperties<T>(
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

/**
 * Construct a union of properties that are functions from an object
 *
 * FunctionKeys<{ arg0: () => void; arg1: Function; arg2: string }
 *
 * => "arg0" | "arg1"
 */
export type FunctionKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [Property in keyof T]: T[Property] extends Function ? Property : never;
}[keyof T];

/**
 * Construct a type which only includes functions from an object
 *
 * FunctionProperties<{ arg0: () => void; arg1: Function; arg2: string }
 *
 * => { arg0: () => void; arg1: Function; }
 */
export type FunctionProperties<T> = Pick<T, FunctionKeys<T>>;
