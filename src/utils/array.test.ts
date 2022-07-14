import { wizards } from "../test-data";
import { findLast, flatten, shallowEqual } from "./array";

test("shallowEqual", () => {
  expect(shallowEqual(["hello", "world"], ["hello", "world"])).toBe(true);
  expect(shallowEqual(["hello", "world"], ["hello"])).toBe(false);
  expect(shallowEqual(["hello", "world"], ["hello", "world", "lorem"])).toBe(
    false
  );
});

test("flatten", () => {
  expect(
    flatten([
      [{ op: "remove", path: '/{"id":2}/0' }],
      [{ op: "remove", path: '/{"id":3}/0' }],
    ])
  ).toEqual([
    { op: "remove", path: '/{"id":2}/0' },
    { op: "remove", path: '/{"id":3}/0' },
  ]);
});

test("findLast", () => {
  expect(
    findLast(wizards, (wizard) => wizard.house === "gryffindor")
  ).toMatchObject({ name: "ron" });

  expect(
    findLast(wizards, (wizard) => wizard.house === "hufflepuff")
  ).toBeUndefined();
});
