import { dot } from "../collections";
import { asArray, isNumber } from "../types";
import { isString } from "../types/is-string";

type Order = "asc" | "desc";
type Iteratee = string | string[];

function compare<T>({ a, b }: { a: T; b: T }, property: Iteratee) {
  const $key = asArray(property).join(".");
  const $left = dot(a as Record<string, unknown>, $key) ?? "";
  const $right = dot(b as Record<string, unknown>, $key) ?? "";

  if (isString($left) && isString($right)) {
    return $left.localeCompare($right);
  }

  if (isNumber($left) && isNumber($right)) {
    return $left - $right;
  }

  return 0;
}

export function orderBy<T>(
  collection: T[],
  iteratees: Iteratee | Iteratee[],
  orders?: Order | Order[]
) {
  const $orders = asArray(orders);
  const $comparisons = asArray(iteratees).map((iteratee, index) => [
    iteratee,
    $orders[index] ?? "asc",
  ]) as [Iteratee, Order][];

  return [...collection].sort(
    (a, b) =>
      $comparisons
        .map(([property, order]) =>
          compare(
            {
              a: order === "asc" ? a : b,
              b: order === "asc" ? b : a,
            },
            property
          )
        )
        .find((difference) => difference !== 0) ?? 0
  );
}
