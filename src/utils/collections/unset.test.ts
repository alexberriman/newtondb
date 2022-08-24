import { unset } from "./unset";

test("unset", () => {
  expect(unset({ a: { b: { c: "hello", d: {} } } }, "a.b.c")).toEqual({
    a: { b: { d: {} } },
  });

  expect(unset(["banana", "apple", "pear"], "0")).toEqual(["apple", "pear"]);
});
