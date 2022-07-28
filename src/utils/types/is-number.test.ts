import { isNumber } from "./is-number";

test.each([
  [1, true],
  ["test", false],
  [undefined, false],
])("isNumber(%s) is %s", (input, expected) => {
  const actual = isNumber(input);
  expect(actual).toBe(expected);
});
