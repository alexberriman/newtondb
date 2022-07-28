import { unset } from "./unset";

test("unset", () => {
  expect(unset({ a: { b: { c: "hello", d: {} } } }, "a.b.c")).toEqual({
    a: { b: { d: {} } },
  });
});
