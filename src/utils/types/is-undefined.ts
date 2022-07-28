export function isUndefined<T>(value: T | undefined): value is undefined {
  return value === undefined;
}
