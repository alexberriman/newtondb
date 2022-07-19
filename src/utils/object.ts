import { isArray, isNumeric, isObject } from "./types";

export function objectSubset<T, K extends keyof T>(
  object: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce(
    (subset, key) => ({ ...subset, [key]: object[key] }),
    {}
  ) as Pick<T, K>;
}

export function dot(object: Record<string, unknown>, path: string) {
  return path.split(".").reduce((value: unknown, accessor) => {
    if (isObject(value)) {
      return value[accessor];
    }

    if (isArray(value)) {
      return value[Number(accessor)];
    }

    return undefined;
  }, object);
}

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

export function set<T>(obj: T, path: string, value: unknown) {
  const parts = path.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts.reduce((o: any, key: string, index: number) => {
    const isLast = index === parts.length - 1;

    if (isLast) {
      o[key] = value;
    } else if (!o[key]) {
      o[key] = isNumeric(key) ? [] : {};
    }

    return o[key];
  }, obj);

  return obj as T;
}

export function unset<T>(obj: T, path: string) {
  const parts = path.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts.reduce((o: any, key: string, index: number) => {
    const isLast = index === parts.length - 1;

    if (isLast) {
      delete o[key];
    } else if (!o[key]) {
      o[key] = isNumeric(key) ? [] : {};
    }

    return o[key];
  }, obj);

  return obj as T;
}

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
