import { wizards } from "../test-data";
import { dot, keyBy, objectSubset } from "./object";

test("objectSubset", () => {
  expect(
    objectSubset({ name: "Alex", age: 30, male: true }, ["name", "male"])
  ).toEqual({ name: "Alex", male: true });
});

test("dot", () => {
  const obj = {
    name: "harry",
    house: {
      name: "gryffindor",
      students: [{ name: "hermione" }, { name: "ron" }],
    },
  };

  expect(dot(obj, "name")).toBe(obj.name);
  expect(dot(obj, "house")).toEqual(obj.house);
  expect(dot(obj, "house.name")).toBe(obj.house.name);
  expect(dot(obj, "house.students.1.name")).toBe(obj.house.students[1].name);
  expect(dot(obj, "lorem")).toBeUndefined();
  expect(dot(obj, "house.a.b.d.a.name")).toBeUndefined();
  expect(dot(obj, "0.a.b.d.a.name")).toBeUndefined();
});

test("keyBy", () => {
  const $wizards = keyBy(wizards, "id");
  expect($wizards).toMatchObject({
    1: wizards[0],
    2: wizards[1],
    3: wizards[2],
    4: wizards[3],
  });
});
