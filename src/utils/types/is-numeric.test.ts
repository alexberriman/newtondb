import { isNumeric } from "./is-numeric";

test.each([
  [1, true],
  ["test", false],
  [false, false],
  [[], false],
  [{}, false],
  [null, false],
  [undefined, false],
  ["1", true],
])("isNumeric(%s) is %s", (input, expected) => {
  const actual = isNumeric(input);
  expect(actual).toBe(expected);
});
