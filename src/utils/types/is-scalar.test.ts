import { isScalar } from "./is-scalar";

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
