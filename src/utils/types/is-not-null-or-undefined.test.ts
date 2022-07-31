import { isNotNullOrUndefined } from "./is-not-null-or-undefined";

test.each([
  [1, true],
  ["test", true],
  [false, true],
  [[], true],
  [{}, true],
  [null, false],
  [undefined, false],
  ["1", true],
])("isNotNullOrUndefined(%s) is %s", (input, expected) => {
  const actual = isNotNullOrUndefined(input);
  expect(actual).toBe(expected);
});
