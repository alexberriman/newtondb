import { isDefined } from "./is-defined";

test.each([
  [1, true],
  ["test", true],
  [undefined, false],
])("isDefined(%s) is %s", (input, expected) => {
  const actual = isDefined(input);
  expect(actual).toBe(expected);
});
