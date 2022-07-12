import { evaluate, type AdvancedCondition } from "./query";

const isMatch =
  <T, O>(condition: AdvancedCondition, preProcessor?: (input: T) => O) =>
  (item: T) =>
    evaluate(condition, preProcessor ? preProcessor(item) : item);

export function query<T, O>(
  data: T[],
  condition: AdvancedCondition,
  preProcessor?: (input: T) => O
): T[] {
  const fn = isMatch(condition, preProcessor);
  return data.filter(fn);
}

export function get<T, O>(
  data: T[],
  condition: AdvancedCondition,
  preProcessor?: (input: T) => O
): T | undefined {
  const fn = isMatch(condition, preProcessor);
  return data.find(fn);
}
