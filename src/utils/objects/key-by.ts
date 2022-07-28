export function keyBy<T>(input: T[], keyAttribute: string): Record<string, T> {
  return input.reduce(
    (obj, item) => ({
      ...obj,
      [(item as Record<string, unknown>)[keyAttribute] as unknown as string]:
        item,
    }),
    {}
  );
}
