export function subset<T, K extends keyof T>(object: T, keys: K[]): Pick<T, K> {
  return keys.reduce(
    (subset, key) => ({ ...subset, [key]: object[key] }),
    {}
  ) as Pick<T, K>;
}
