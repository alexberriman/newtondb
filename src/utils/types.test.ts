import { wizards } from "../test-data";
import {
  asArray,
  isArray,
  isDefined,
  isNumber,
  isObject,
  isPartial,
  isScalar,
} from "./types";

test.each([
  [1, true],
  ["test", true],
  [false, true],
  [[], false],
  [{}, false],
  [null, false],
  [undefined, false],
])("isScalar(%s) is %s", (input, expected) => {
  const actual = isScalar(input);
  expect(actual).toBe(expected);
});

test.each([
  [1, false],
  ["test", false],
  [[], false],
  [{}, true],
])("isObject(%s) is %s", (input, expected) => {
  const actual = isObject(input);
  expect(actual).toBe(expected);
});

test.each([
  [1, false],
  ["test", false],
  [[], true],
  [{}, false],
])("isArray(%s) is %s", (input, expected) => {
  const actual = isArray(input);
  expect(actual).toBe(expected);
});

test.each([
  [1, true],
  ["test", true],
  [undefined, false],
])("isDefined(%s) is %s", (input, expected) => {
  const actual = isDefined(input);
  expect(actual).toBe(expected);
});

test.each([
  [1, true],
  ["test", false],
  [undefined, false],
])("isNumber(%s) is %s", (input, expected) => {
  const actual = isNumber(input);
  expect(actual).toBe(expected);
});

test.each([
  [false, false],
  ["test", false],
  [undefined, false],
  [1, false],
  [[], false],
  [{ name: "harry" }, true],
  [{ id: 1, name: "harry" }, true],
  [{ id: 1, name: "harry", lorem: "ipsum" }, false],
])("isPartial(%s) is %s", (input, expected) => {
  const actual = isPartial(input, wizards[0]);
  expect(actual).toBe(expected);
});

test.each([
  ["test", ["test"]],
  [
    ["test", "test2"],
    ["test", "test2"],
  ],
])("asArray(%s) is %s", (input, expected) => {
  const actual = asArray(input);
  expect(actual).toEqual(expected);
});
