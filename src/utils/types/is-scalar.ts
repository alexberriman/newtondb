export function isScalar(value: unknown): value is string | number | boolean {
  return ["number", "string", "boolean"].includes(typeof value);
}
