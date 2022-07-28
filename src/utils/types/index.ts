export { asArray } from "./as-array";
export { isArray } from "./is-array";
export { isDefined } from "./is-defined";
export { isMultiDimensionalArray } from "./is-multi-dimensional-array";
export { isNotNullOrUndefined } from "./is-not-null-or-undefined";
export { isNotNull } from "./is-not-null";
export { isNull } from "./is-null";
export { isNumber } from "./is-number";
export { isNumeric } from "./is-numeric";
export { isObjectOfProperties } from "./is-object-of-properties";
export { isObject } from "./is-object";
export { isPartial } from "./is-partial";
export { isPopulatedArray } from "./is-populated-array";
export { isScalar } from "./is-scalar";
export { isSingleArray } from "./is-single-array";
export { isUndefined } from "./is-undefined";

export type Flatten<T> = T extends unknown[] ? T[number] : T;

export type AsArray<T> = T extends unknown[] ? T : T[];

export type ScalarOrArray<T> = T | T[];

export type Subset<T, D, K extends keyof D> = T extends unknown[]
  ? Pick<D, K>[]
  : Pick<D, K>;

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

export function isCallable<T>(value: unknown): value is T {
  return typeof value === "function";
}
