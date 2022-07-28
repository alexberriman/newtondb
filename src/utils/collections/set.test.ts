import { set } from "./set";

test("set", () => {
  expect(set({}, "a.b.c", "hello")).toEqual({ a: { b: { c: "hello" } } });
});
