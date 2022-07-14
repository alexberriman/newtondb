export function shallowEqual(left: unknown[], right: unknown[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

export function flatten<T>(input: T[][]): T[] {
  return input.reduce((flattened, items) => [...flattened, ...items], []);
}

export function findLast<T>(
  items: T[],
  predicate: (item: T) => boolean
): T | undefined {
  for (let index = items.length - 1; index >= 0; index--) {
    if (predicate(items[index])) {
      return items[index];
    }
  }
}
