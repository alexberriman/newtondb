import { wizards } from "../../test-data";
import { keyArrayBy } from "./key-array-by";

test("keyArrayBy", () => {
  expect(keyArrayBy(wizards, "non-existent-key")).toEqual({});
  expect(keyArrayBy(wizards, "house")).toMatchObject({
    gryffindor: [
      { id: 1, name: "harry" },
      { id: 2, name: "hermione" },
      { id: 3, name: "ron" },
    ],
    slytherin: [{ id: 4, name: "draco" }],
  });
});
