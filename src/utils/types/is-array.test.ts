import { isArray } from "./is-array";

test.each([
  [1, false],
  ["test", false],
  [[], true],
  [{}, false],
])("isArray(%s) is %s", (input, expected) => {
  const actual = isArray(input);
  expect(actual).toBe(expected);
});
