import { wizards } from "../test-data";
import { objectSubset } from "../utils/object";
import { createHashTable, deleteItem, get, insert } from "./hash-table";

const hashTable = createHashTable(
  [
    ...wizards,
    { id: 100, name: "harry", house: "unknown", born: 1066, married: false },
  ],
  {
    index: ["name"],
    item: (o) => objectSubset(o as unknown as Record<string, unknown>, ["id"]),
  }
);

test("createHashTable", () => {
  expect(hashTable.data).toEqual({
    '{"name":"harry"}': [{ id: 1 }, { id: 100 }],
    '{"name":"hermione"}': [{ id: 2 }],
    '{"name":"ron"}': [{ id: 3 }],
    '{"name":"draco"}': [{ id: 4 }],
  });
});

test("get", () => {
  const hermione = get(hashTable, { name: "hermione" });
  expect(hermione).toEqual([{ id: 2 }]);

  const nonExistent = get(hashTable, { name: "michael jordan" });
  expect(nonExistent).toEqual([]);
});

test("delete", () => {
  const updated = deleteItem(hashTable, { name: "hermione" });
  expect(updated.data).toEqual({
    '{"name":"harry"}': [{ id: 1 }, { id: 100 }],
    '{"name":"ron"}': [{ id: 3 }],
    '{"name":"draco"}': [{ id: 4 }],
  });
});

test("insert", () => {
  const updated = insert(hashTable, {
    id: 200,
    name: "rachel",
    house: "ravenclaw",
    born: 1990,
    married: false,
  });

  expect(updated.data).toEqual({
    '{"name":"harry"}': [{ id: 1 }, { id: 100 }],
    '{"name":"hermione"}': [{ id: 2 }],
    '{"name":"ron"}': [{ id: 3 }],
    '{"name":"draco"}': [{ id: 4 }],
    '{"name":"rachel"}': [{ id: 200 }],
  });
});
