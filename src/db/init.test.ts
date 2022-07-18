import { FileAdapter } from "../adapters/file-adapter";
import { MemoryAdapter } from "../adapters/memory-adapter";
import { Collection } from "../collection/collection";
import { House, Wizard, houses, wizards } from "../test-data";
import { Database } from "./init";

it("instantiates a collection db using default memory adapter", () => {
  const db = new Database(wizards);

  expect(db.$).toBeInstanceOf(Collection);
  expect(db.$.get({ name: "hermione" }).data).toMatchObject({
    name: "hermione",
  });
});

it("instantiates a dictionary db using default memory adapt", () => {
  const db = new Database({ houses, wizards });

  expect(db.$.houses).toBeInstanceOf(Collection);
  expect(db.$.wizards).toBeInstanceOf(Collection);
  expect(db.$.houses.get({ id: "slytherin" }).data).toMatchObject({
    id: "slytherin",
  });
});

it("instantiates a collection db using an explicit memory adapter", async () => {
  const db = new Database(new MemoryAdapter(wizards));
  await db.read();

  expect(db.$).toBeInstanceOf(Collection);
  expect(db.$.get({ name: "hermione" }).data).toMatchObject({
    name: "hermione",
  });
});

it("instantiates a dictionary db using an explicit memory adapter", async () => {
  const db = new Database(new MemoryAdapter({ houses }));
  await db.read();

  expect(db.$.houses).toBeInstanceOf(Collection);
  expect(db.$.houses.get({ id: "gryffindor" }).data).toMatchObject({
    id: "gryffindor",
  });
});

it("instantiates a collection db from file", async () => {
  const adapter = new FileAdapter("./examples/data/wizards.json");
  const db = new Database<Wizard[]>(adapter);
  await db.read();

  expect(db.$.find({ name: "harry" }).data).toMatchObject([{ name: "harry" }]);
});

it("instantiates a dictionary db from file", async () => {
  const adapter = new FileAdapter("./examples/data/db.json");
  const db = new Database<{ houses: House[]; wizards: Wizard[] }>(adapter);
  await db.read();

  expect(db.$.houses.get({ id: "ravenclaw" }).data).toMatchObject({
    id: "ravenclaw",
    emblem: "eagle",
  });
});

it("lets you set collection options for a collection db", () => {
  const db = new Database(wizards, { collection: { primaryKey: ["name"] } });

  expect(Object.keys(db.$.hashTable.table)).toEqual([
    '{"name":"harry"}',
    '{"name":"hermione"}',
    '{"name":"ron"}',
    '{"name":"draco"}',
  ]);
});

it("lets you set collection options for a named database db", () => {
  const db = new Database(
    { houses, wizards },
    { collection: { houses: { primaryKey: ["emblem"] } } }
  );

  expect(Object.keys(db.$.houses.hashTable.table)).toEqual([
    '{"emblem":"lion"}',
    '{"emblem":"badger"}',
    '{"emblem":"eagle"}',
    '{"emblem":"serpent"}',
  ]);
});
