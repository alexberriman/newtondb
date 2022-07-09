import { objectSubset } from "./object";

test("objectSubset", () => {
  expect(
    objectSubset({ name: "Alex", age: 30, male: true }, ["name", "male"])
  ).toEqual({ name: "Alex", male: true });
});
