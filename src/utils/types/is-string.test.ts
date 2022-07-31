import { isString } from "./is-string";

describe("isString", () => {
  test.each([
    [undefined, false],
    [false, false],
    [true, false],
    [{}, false],
    [[], false],
    [null, false],
    ["", true],
    ["lorem", true],
  ])("isString(%s) returns %s", (input, expected) => {
    expect(isString(input)).toBe(expected);
  });
});
