export function objectSubset<T extends Record<string, unknown>>(
  object: Record<string, unknown>,
  keys: string[]
): Partial<T> {
  return keys.reduce((subset, key) => ({ ...subset, [key]: object[key] }), {});
}
