// @todo:
// pre-processors:
//    - case insensitivity
//    - type coercion

import { dot } from "../../utils/object";
import { isObject } from "../../utils/types";

type PreProcessor = string | { fn: string; args: (Property | unknown)[] };

type Property = string | { name: string; preProcess?: PreProcessor[] };

type ValueReference = {
  property: Property;
};

type ConditionValue<T> = T | ValueReference;

interface BaseCondition {
  property: Property;
}

interface StringCondition extends BaseCondition {
  operator: "startsWith" | "endsWith" | "matchesRegex" | "doesNotMatchRegex";
  value: ConditionValue<string>;
}

interface ScalarCondition extends BaseCondition {
  operator: "equal" | "notEqual";
  value: ConditionValue<string | number | boolean>;
}

interface NumericCondition extends BaseCondition {
  operator:
    | "lessThan"
    | "lessThanInclusive"
    | "greaterThan"
    | "greaterThanInclusive";
  value: ConditionValue<number>;
}

interface ArrayInCondition extends BaseCondition {
  operator: "in" | "notIn";
  value: ConditionValue<unknown[]>;
}

interface ContainsCondition extends BaseCondition {
  operator: "contains" | "doesNotContain";
  value: ConditionValue<string | number | boolean>;
}

type AtomicCondition =
  | StringCondition
  | ScalarCondition
  | NumericCondition
  | ArrayInCondition
  | ContainsCondition;

type AndCondition = { and: AdvancedCondition[] };

type OrCondition = { or: AdvancedCondition[] };

export type AdvancedCondition = AtomicCondition | AndCondition | OrCondition;

function isValueReference<T>(
  value: ConditionValue<T>
): value is ValueReference {
  return isObject(value) && "property" in value;
}

function isStringCondition(
  condition: AtomicCondition
): condition is StringCondition {
  return [
    "startsWith",
    "endsWith",
    "matchesRegex",
    "doesNotMatchRegex",
  ].includes(condition.operator);
}

function isScalarCondition(
  condition: AtomicCondition
): condition is ScalarCondition {
  return ["equal", "notEqual"].includes(condition.operator);
}

function isNumericCondition(
  condition: AtomicCondition
): condition is NumericCondition {
  return [
    "lessThan",
    "lessThanInclusive",
    "greaterThan",
    "greaterThanInclusive",
  ].includes(condition.operator);
}

function isInCondition(
  condition: AtomicCondition
): condition is ArrayInCondition {
  return ["in", "notIn"].includes(condition.operator);
}

function isAtomicCondition(condition: unknown): condition is AtomicCondition {
  return isObject(condition) && "operator" in condition;
}

export function isCondition(
  condition: unknown
): condition is AdvancedCondition {
  return (
    isAtomicCondition(condition) ||
    (isObject(condition) && ("and" in condition || "or" in condition))
  );
}

function getByProperty(
  object: Record<string, unknown>,
  property: Property
): unknown {
  if (typeof property === "string") {
    return dot(object, property);
  }

  // @todo preprocessors
  const value = dot(object, property.name);

  return value;
}

function getConditionValue<ValueType, CandidateType>(
  value: ConditionValue<ValueType>,
  candidate: CandidateType
): ValueType {
  if (isValueReference(value)) {
    return getByProperty(
      candidate as Record<string, unknown>,
      value.property
    ) as ValueType;
  }

  return value;
}

function evaluateStringCondition<T>(condition: StringCondition, candidate: T) {
  const source = getByProperty(
    candidate as Record<string, unknown>,
    condition.property
  ) as string;
  const value = getConditionValue(condition.value, candidate);

  switch (condition.operator) {
    case "startsWith":
      return source.startsWith(value);
    case "endsWith":
      return source.endsWith(value);
    case "matchesRegex":
      return !!source.match(new RegExp(value));
    case "doesNotMatchRegex":
      return !source.match(new RegExp(value));
  }
}

function evaluateScalarCondition<T>(condition: ScalarCondition, candidate: T) {
  const source = getByProperty(
    candidate as Record<string, unknown>,
    condition.property
  );
  const value = getConditionValue(condition.value, candidate);

  return condition.operator === "equal" ? source === value : source !== value;
}

function evaluateNumericCondition<T>(
  condition: NumericCondition,
  candidate: T
) {
  const source = getByProperty(
    candidate as Record<string, unknown>,
    condition.property
  ) as number;
  const value = getConditionValue(condition.value, candidate);

  switch (condition.operator) {
    case "lessThan":
      return source < value;
    case "lessThanInclusive":
      return source <= value;
    case "greaterThan":
      return source > value;
    case "greaterThanInclusive":
      return source >= value;
  }
}

function evaluateInCondition<T>(condition: ArrayInCondition, candidate: T) {
  const source = getByProperty(
    candidate as Record<string, unknown>,
    condition.property
  );
  const value = getConditionValue(condition.value, candidate);

  return condition.operator === "in"
    ? value.includes(source)
    : !value.includes(source);
}

function evaluateContainsCondition<T>(
  condition: ContainsCondition,
  candidate: T
) {
  const source = getByProperty(
    candidate as Record<string, unknown>,
    condition.property
  );
  const value = getConditionValue(condition.value, candidate);

  if (
    Array.isArray(source) ||
    (typeof source === "string" && typeof value === "string")
  ) {
    return condition.operator === "contains"
      ? source.includes(value as string)
      : !source.includes(value as string);
  }

  return false;
}

function evaluateAtom<T>(condition: AtomicCondition, candidate: T) {
  if (isStringCondition(condition)) {
    return evaluateStringCondition(condition, candidate);
  }

  if (isScalarCondition(condition)) {
    return evaluateScalarCondition(condition, candidate);
  }

  if (isNumericCondition(condition)) {
    return evaluateNumericCondition(condition, candidate);
  }

  if (isInCondition(condition)) {
    return evaluateInCondition(condition, candidate);
  }

  return evaluateContainsCondition(condition, candidate);
}

export function evaluate<T>(
  condition: AdvancedCondition,
  candidate: T
): boolean {
  if (isAtomicCondition(condition)) {
    return evaluateAtom(condition, candidate);
  }

  if ("and" in condition) {
    return condition.and.every((condition) => evaluate(condition, candidate));
  }

  return condition.or.some((condition) => evaluate(condition, candidate));
}
