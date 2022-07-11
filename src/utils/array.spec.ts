import { shallowEqual } from "./array";

test("shallowEqual", () => {
  expect(shallowEqual(["hello", "world"], ["hello", "world"])).toBe(true);
  expect(shallowEqual(["hello", "world"], ["hello"])).toBe(false);
  expect(shallowEqual(["hello", "world"], ["hello", "world", "lorem"])).toBe(
    false
  );
});
