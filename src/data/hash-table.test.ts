import { wizards } from "../test-data";
import { HashTable } from "./hash-table";

const extraWizards = {
  neville: {
    id: 100,
    name: "neville",
    house: "gryffindor",
    born: 1980,
    married: false,
  },
};

it("initializes correctly with default options", () => {
  const $ = new HashTable(wizards);
  expect($.data).toEqual({
    "0": [{ position: 0, index: "0", data: wizards[0] }],
    "1": [{ position: 1, index: "1", data: wizards[1] }],
    "2": [{ position: 2, index: "2", data: wizards[2] }],
    "3": [{ position: 3, index: "3", data: wizards[3] }],
  });
});

it("stores a subset of data when item option passed through", () => {
  const $ = new HashTable(wizards, { attributes: ["id"] });
  expect($.data).toEqual({
    "0": [{ position: 0, index: "0", data: { id: 1 } }],
    "1": [{ position: 1, index: "1", data: { id: 2 } }],
    "2": [{ position: 2, index: "2", data: { id: 3 } }],
    "3": [{ position: 3, index: "3", data: { id: 4 } }],
  });
});

it("keys by supplied keyBy option", () => {
  const $ = new HashTable(wizards, { keyBy: ["id", "name"] });
  expect($.data).toEqual({
    '{"id":1,"name":"harry"}': [
      { position: 0, index: { id: 1, name: "harry" }, data: wizards[0] },
    ],
    '{"id":2,"name":"hermione"}': [
      { position: 1, index: { id: 2, name: "hermione" }, data: wizards[1] },
    ],
    '{"id":3,"name":"ron"}': [
      { position: 2, index: { id: 3, name: "ron" }, data: wizards[2] },
    ],
    '{"id":4,"name":"draco"}': [
      { position: 3, index: { id: 4, name: "draco" }, data: wizards[3] },
    ],
  });
});

test("get returns by index", () => {
  const $ = new HashTable(wizards, { keyBy: ["id", "name"] });
  const hermione = $.get({ id: 2, name: "hermione" });

  expect(hermione).toHaveLength(1);
  expect(hermione[0]).toMatchObject({ name: "hermione" });
});

test("get returns by scalar", () => {
  const $ = new HashTable(wizards, { keyBy: ["name"] });
  const ron = $.get("ron");

  expect(ron).toHaveLength(1);
  expect(ron[0]).toMatchObject({ name: "ron" });
});

test("get returns an empty array when not found", () => {
  const $ = new HashTable(wizards, { keyBy: ["name"] });
  const ron = $.get("sirius");
  expect(ron).toHaveLength(0);
});

test("get returns by numeric scalar when no index", () => {
  const $ = new HashTable(wizards);
  const draco = $.get(3);

  expect(draco).toHaveLength(1);
  expect(draco[0]).toMatchObject({ name: "draco" });
});

it("inserts", () => {
  const $ = new HashTable(wizards, { keyBy: ["id", "name"] });
  expect($.size).toBe(4);

  $.insert(extraWizards.neville);
  expect($.size).toBe(5);
  expect($.data).toEqual({
    '{"id":1,"name":"harry"}': [
      { position: 0, index: { id: 1, name: "harry" }, data: wizards[0] },
    ],
    '{"id":2,"name":"hermione"}': [
      { position: 1, index: { id: 2, name: "hermione" }, data: wizards[1] },
    ],
    '{"id":3,"name":"ron"}': [
      { position: 2, index: { id: 3, name: "ron" }, data: wizards[2] },
    ],
    '{"id":4,"name":"draco"}': [
      { position: 3, index: { id: 4, name: "draco" }, data: wizards[3] },
    ],
    '{"id":100,"name":"neville"}': [
      {
        position: 4,
        index: { id: 100, name: "neville" },
        data: extraWizards.neville,
      },
    ],
  });
});
