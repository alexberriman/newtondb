export function isDefined(value: unknown) {
  return value !== undefined;
}

export function isScalar(value: unknown): value is string | number | boolean {
  return ["number", "string", "boolean"].includes(typeof value);
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

export function asArray<T>(value: T | T[]) {
  return isArray(value) ? value : [value];
}
