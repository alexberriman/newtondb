import { isArray } from "../types";

export function flatten<T>(input: unknown[]): T[] {
  return input.reduce((flat: T[], value) => {
    if (!isArray(value)) {
      return [...flat, value as T];
    }

    return [...flat, ...flatten(value)] as T[];
  }, []);
}
