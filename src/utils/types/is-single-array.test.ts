import { isSingleArray } from "./is-single-array";

describe("isSingleArray", () => {
  test.each([
    [undefined, false],
    [false, false],
    [true, false],
    [{}, false],
    [[], false],
    [["value"], true],
    [["value", "ipsum"], false],
    [null, false],
    ["", false],
    ["lorem", false],
  ])("isSingleArray(%s) returns %s", (input, expected) => {
    expect(isSingleArray(input)).toBe(expected);
  });
});
