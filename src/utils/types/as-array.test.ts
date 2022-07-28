import { asArray } from "./as-array";

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
