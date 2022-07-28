export function cloneDeep<T>(source: T): T {
  if (Array.isArray(source)) {
    return source.map((item) => cloneDeep(item)) as unknown as T;
  }

  if (source instanceof Date) {
    return new Date(source.getTime()) as unknown as T;
  }

  if (source && typeof source === "object") {
    return Object.getOwnPropertyNames(source).reduce((o, prop) => {
      Object.defineProperty(
        o,
        prop,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Object.getOwnPropertyDescriptor(source, prop)!
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      o[prop] = cloneDeep((source as { [key: string]: any })[prop]);

      return o;
    }, Object.create(Object.getPrototypeOf(source)));
  }

  return source as T;
}
