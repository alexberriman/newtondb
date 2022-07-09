import { addPreprocessor, preProcess } from "./preprocess";

it("executes a basic preprocessor", () => {
  addPreprocessor("capitalize", (value: string) => value.toUpperCase());

  expect(
    preProcess({ name: "capitalize", args: ["hello"], defaultValue: "a" })
  ).toBe("HELLO");
});

it("returns default on error", () => {
  expect(
    preProcess({ name: "lorem", args: ["hello"], defaultValue: "a" })
  ).toBe("a");

  expect(preProcess({ name: "capitalize", args: [], defaultValue: "a" })).toBe(
    "a"
  );
});
