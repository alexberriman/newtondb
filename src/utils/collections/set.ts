import { isNumeric } from "../types";

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
