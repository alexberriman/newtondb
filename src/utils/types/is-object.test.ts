import { isObject } from "./is-object";

test.each([
  [1, false],
  ["test", false],
  [[], false],
  [{}, true],
])("isObject(%s) is %s", (input, expected) => {
  const actual = isObject(input);
  expect(actual).toBe(expected);
});
