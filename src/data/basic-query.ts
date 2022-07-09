const isMatch =
  <T>(condition: Partial<T>) =>
  (item: T) =>
    Object.entries(condition).every(
      ([key, value]) => item[key as keyof T] === value
    );

export function query<T>(data: T[], condition: Partial<T>): T[] {
  return data.filter(isMatch(condition));
}

export function get<T>(data: T[], condition: Partial<T>): T | undefined {
  return data.find(isMatch(condition));
}
