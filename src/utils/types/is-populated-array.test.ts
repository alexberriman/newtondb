import { isPopulatedArray } from "./is-populated-array";

describe("isPopulatedArray", () => {
  test.each([
    [undefined, false],
    [false, false],
    [true, false],
    [{}, false],
    [[], false],
    [["value"], true],
    [["value", "ipsum"], true],
    [null, false],
    ["", false],
    ["lorem", false],
  ])("isPopulatedArray(%s) returns %s", (input, expected) => {
    expect(isPopulatedArray(input)).toBe(expected);
  });
});
