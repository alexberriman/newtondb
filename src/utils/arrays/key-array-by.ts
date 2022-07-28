import { isDefined } from "../types";

export function keyArrayBy<T>(
  input: T[],
  keyAttribute: string
): Record<string, T[]> {
  return input.reduce((obj: Record<string, T[]>, item) => {
    const $item = item as Record<string, unknown>;
    if (!isDefined($item[keyAttribute])) {
      return obj;
    }

    const key = $item[keyAttribute] as unknown as string;
    const existing = obj[key] ?? [];

    return {
      ...obj,
      [key]: [...existing, item],
    };
  }, {});
}
