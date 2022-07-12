import { extraWizards, wizards } from "../test-data";
import { HashTable } from "./hash-table";

it("initializes correctly with default options", () => {
  const $ = new HashTable(wizards);

  expect($.table).toMatchObject({
    "0": [{ index: "0", data: wizards[0], previous: null }],
    "1": [{ index: "1", data: wizards[1] }],
    "2": [{ index: "2", data: wizards[2] }],
    "3": [{ index: "3", data: wizards[3], next: null }],
  });
});

it("stores a subset of data when properties option passed through", () => {
  const $ = new HashTable(wizards, { properties: ["id"] });
  expect($.table).toMatchObject({
    "0": [{ index: "0", data: { id: 1 } }],
    "1": [{ index: "1", data: { id: 2 } }],
    "2": [{ index: "2", data: { id: 3 } }],
    "3": [{ index: "3", data: { id: 4 } }],
  });
});

it("keys by supplied keyBy option", () => {
  const $ = new HashTable(wizards, { keyBy: ["id", "name"] });
  expect($.table).toMatchObject({
    '{"id":1,"name":"harry"}': [
      { index: { id: 1, name: "harry" }, data: wizards[0] },
    ],
    '{"id":2,"name":"hermione"}': [
      { index: { id: 2, name: "hermione" }, data: wizards[1] },
    ],
    '{"id":3,"name":"ron"}': [
      { index: { id: 3, name: "ron" }, data: wizards[2] },
    ],
    '{"id":4,"name":"draco"}': [
      { index: { id: 4, name: "draco" }, data: wizards[3] },
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
  const sirius = $.get("sirius");
  expect(sirius).toHaveLength(0);
});

test("get returns by numeric scalar when no index", () => {
  const $ = new HashTable(wizards);
  const draco = $.get(3);

  expect(draco).toHaveLength(1);
  expect(draco[0]).toMatchObject({ name: "draco" });
});

test("get returns the 'raw' entry what `asItem` is false", () => {
  const $ = new HashTable(wizards, { keyBy: ["name"] });
  const harry = $.get("harry", { asItem: false });

  expect(harry).toMatchObject([
    {
      index: { name: "harry" },
      hash: '{"name":"harry"}',
      data: {
        id: 1,
        name: "harry",
      },
    },
  ]);
});

it("inserts", () => {
  const $ = new HashTable(wizards, { keyBy: ["id", "name"] });
  expect($.size).toBe(4);

  $.insert(extraWizards.neville);
  expect($.size).toBe(5);
  expect($.table).toMatchObject({
    '{"id":1,"name":"harry"}': [
      { index: { id: 1, name: "harry" }, data: wizards[0] },
    ],
    '{"id":2,"name":"hermione"}': [
      { index: { id: 2, name: "hermione" }, data: wizards[1] },
    ],
    '{"id":3,"name":"ron"}': [
      { index: { id: 3, name: "ron" }, data: wizards[2] },
    ],
    '{"id":4,"name":"draco"}': [
      { index: { id: 4, name: "draco" }, data: wizards[3] },
    ],
    '{"id":100,"name":"neville"}': [
      {
        index: { id: 100, name: "neville" },
        data: extraWizards.neville,
      },
    ],
  });
});

it("converts hash table/linked list to array", () => {
  const $ = new HashTable([...wizards, ...Object.values(extraWizards)]);

  expect($.data).toMatchObject([
    { id: 1, name: "harry" },
    { id: 2, name: "hermione" },
    { id: 3, name: "ron" },
    { id: 4, name: "draco" },
    { id: 100, name: "neville" },
    { id: 101, name: "cho" },
  ]);
});

it("converts hash table/linked list to array of raw nodes", () => {
  const $ = new HashTable([...wizards, ...Object.values(extraWizards)]);
  expect($.nodes).toMatchObject([
    { index: "0", hash: "0", data: { id: 1, name: "harry" } },
    { index: "1", hash: "1", data: { id: 2, name: "hermione" } },
    { index: "2", hash: "2", data: { id: 3, name: "ron" } },
    { index: "3", hash: "3", data: { id: 4, name: "draco" } },
    { index: "4", hash: "4", data: { id: 100, name: "neville" } },
    { index: "5", hash: "5", data: { id: 101, name: "cho" } },
  ]);
});

it("deletes correctly", () => {
  const $ = new HashTable([...wizards, ...Object.values(extraWizards)], {
    keyBy: ["house"],
  });
  expect($.size).toBe(6);

  $.delete(wizards[1]); // delete hermione
  expect($.size).toBe(5);
  expect($.data).toMatchObject([
    { id: 1, name: "harry" },
    { id: 3, name: "ron" },
    { id: 4, name: "draco" },
    { id: 100, name: "neville" },
    { id: 101, name: "cho" },
  ]);

  // delete first on list
  $.delete(wizards[0]);
  expect($.size).toBe(4);
  expect($.data).toMatchObject([
    { id: 3, name: "ron" },
    { id: 4, name: "draco" },
    { id: 100, name: "neville" },
    { id: 101, name: "cho" },
  ]);

  // delete by scalar
  $.delete("slytherin");
  expect($.size).toBe(3);
  expect($.data).toMatchObject([
    { id: 3, name: "ron" },
    { id: 100, name: "neville" },
    { id: 101, name: "cho" },
  ]);

  // delete by index (and last on list)
  $.delete({ house: "ravenclaw" });
  expect($.size).toBe(2);
  expect($.data).toMatchObject([
    { id: 3, name: "ron" },
    { id: 100, name: "neville" },
  ]);

  // doesn't delete when no match
  $.delete(wizards[0]);
  expect($.size).toBe(2);
});

it("deletes by scalar when no key set", () => {
  const $ = new HashTable(wizards);
  expect($.size).toBe(4);

  $.delete(1);
  expect($.size).toBe(3);
  expect($.data).toMatchObject([
    { id: 1, name: "harry" },
    { id: 3, name: "ron" },
    { id: 4, name: "draco" },
  ]);
});

it("deletes multiple by index", () => {
  const $ = new HashTable(wizards, { keyBy: ["house"] });

  $.delete({ house: "gryffindor" });
  expect($.size).toBe(1);
  expect($.data).toMatchObject([{ id: 4, name: "draco" }]);
});

it("deletes by predicate", () => {
  const $ = new HashTable(wizards, {
    properties: ["id", "house"],
    keyBy: ["house"],
  });

  $.delete({ house: "gryffindor" }, (data) => data.id === 3);
  expect($.size).toBe(3);
  expect($.data).toEqual([
    { id: 1, house: "gryffindor" },
    { id: 2, house: "gryffindor" },
    { id: 4, house: "slytherin" },
  ]);
});
