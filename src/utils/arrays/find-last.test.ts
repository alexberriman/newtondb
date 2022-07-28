import { wizards } from "../../test-data";
import { findLast } from "./find-last";

test("findLast", () => {
  expect(
    findLast(wizards, (wizard) => wizard.house === "gryffindor")
  ).toMatchObject({ name: "ron" });

  expect(
    findLast(wizards, (wizard) => wizard.house === "hufflepuff")
  ).toBeUndefined();
});
