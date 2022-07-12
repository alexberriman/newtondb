import { FindError } from "../errors/find-error";
import { isDefined, isObject, isScalar } from "../utils/types";
import type { FindPredicate } from "./collection";

interface CreateConditionOptions<T> {
  primaryKey: T[];
}

export function createCondition<T extends string | number | symbol>(
  condition: unknown,
  { primaryKey }: CreateConditionOptions<T>
) {
  if (!isDefined(condition)) {
    return {};
  }

  if (isObject(condition)) {
    return condition;
  }

  if (isScalar(condition) && primaryKey.length === 1) {
    return { [primaryKey[0]]: condition };
  }

  throw new FindError(
    "Attempted to find by a scalar without configuring a primaryKey"
  );
}

export function isFindPredicate<T, Y>(
  candidate: unknown
): candidate is FindPredicate<T, Y> {
  return typeof candidate === "function";
}
