import { wizards } from "../test-data";
import { createUpdateOperations, toPointer, toTokens } from "./json-patch";

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

describe("createUpdateOperations", () => {
  it("creates successfully", () => {
    const actual = createUpdateOperations(wizards[0], {
      name: "sirius",
      married: true,
      wand: "phoenix feather",
    });

    expect(actual).toEqual([
      { op: "replace", value: "sirius", path: "/name" },
      { op: "add", value: "phoenix feather", path: "/wand" },
    ]);
  });

  it("uses a prefix", () => {
    const actual = createUpdateOperations(
      wizards[0],
      {
        name: "sirius",
      },
      "lorem/~ipsum"
    );

    expect(actual).toEqual([
      { op: "replace", value: "sirius", path: "/lorem~1~0ipsum/name" },
    ]);
  });

  it("creates from a prefix array", () => {
    const actual = createUpdateOperations(
      wizards[0],
      {
        name: "sirius",
      },
      ["lor~em", "ipsu/m"]
    );

    expect(actual).toEqual([
      { op: "replace", value: "sirius", path: "/lor~0em/ipsu~1m/name" },
    ]);
  });
});
