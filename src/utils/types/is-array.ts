export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}
