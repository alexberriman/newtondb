import { isNotNull } from "./is-not-null";

test.each([
  [1, true],
  ["test", true],
  [false, true],
  [[], true],
  [{}, true],
  [null, false],
  [undefined, true],
  ["1", true],
])("isNotNull(%s) is %s", (input, expected) => {
  const actual = isNotNull(input);
  expect(actual).toBe(expected);
});
