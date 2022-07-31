import { isObjectOfProperties } from "./is-object-of-properties";

describe("isObjectOfProperties", () => {
  test.each([
    [undefined, false],
    [false, false],
    [true, false],
    [{}, false],
    [[], false],
    [["value"], false],
    [["value", "ipsum"], false],
    [{ name: "john", age: "10" }, true],
    [{ name: "john", age: "10", dob: "01/01/1960" }, false],
    [null, false],
    ["", false],
    ["lorem", false],
  ])("isObjectOfProperties(%s) returns %s", (input, expected) => {
    expect(isObjectOfProperties(input, ["name", "age"])).toBe(expected);
  });
});
