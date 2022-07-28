import { subset } from "./subset";

test("subset", () => {
  expect(
    subset({ name: "Alex", age: 30, male: true }, ["name", "male"])
  ).toEqual({ name: "Alex", male: true });
});
