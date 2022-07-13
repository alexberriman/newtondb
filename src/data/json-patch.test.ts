import { toPointer, toTokens } from "./json-patch";

describe("toTokens", () => {
  test.each([
    ["basic pointer", "/foo/3/bar", ["foo", "3", "bar"]],
    ["escaped characters", "/f~1o~1o/b~0a~0r", ["f/o/o", "b~a~r"]],
    ["order of un-escaping", "/~01", ["~1"]],
  ])("%s", (scenario: string, input: string, expected: string[]) => {
    expect(toTokens(input)).toEqual(expected);
  });

  it("throws error when non relative value passed through", () => {
    expect(() => {
      toTokens("non relative value");
    }).toThrow(Error);
  });
});

describe("toPointer", () => {
  test.each([
    ["basic pointer", ["foo", 3, "bar"], "/foo/3/bar"],
    ["escaping slash", ["a/b"], "/a~1b"],
    ["escaping tilde", "a~b", "/a~0b"],
    ["numeric", 0, "/0"],
    ["empty", "", "/"],
    ["back slash", "i\\j", "/i\\j"],
    ["multiple spaces", ["   ", "lorem"], "/   /lorem"],
  ])(
    "%s",
    (
      scenario: string,
      input: string | number | (string | number)[],
      expected: string
    ) => {
      expect(toPointer(input)).toEqual(expected);
    }
  );
});
