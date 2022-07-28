export function shallowEqual(left: unknown[], right: unknown[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}
