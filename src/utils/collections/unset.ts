import { isArray, isNumeric } from "../types";

export function unset<T>(obj: T, path: string) {
  const parts = path.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts.reduce((o: any, key: string, index: number) => {
    const isLast = index === parts.length - 1;
    if (isLast) {
      if (isArray(o)) {
        o.splice(Number(key), 1);
      } else {
        delete o[key];
      }
    } else if (!o[key]) {
      o[key] = isNumeric(key) ? [] : {};
    }

    return o[key];
  }, obj);

  return obj as T;
}
