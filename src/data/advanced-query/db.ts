import { evaluate, type AdvancedCondition } from "./query";

const isMatch =
  <T>(condition: AdvancedCondition) =>
  (item: T) =>
    evaluate(condition, item);

export function query<T>(data: T[], condition: AdvancedCondition): T[] {
  return data.filter(isMatch(condition));
}

export function get<T>(data: T[], condition: AdvancedCondition): T | undefined {
  return data.find(isMatch(condition));
}
