import { MemoryAdapter } from "./adapters/memory";
import { Database } from "./database";

interface Wizard {
  id: number;
  name: string;
  house: string;
  born: number;
  married: boolean;
}

interface House {
  id: string;
  emblem: string;
}

const wizards: Wizard[] = [
  { id: 1, name: "harry", house: "gryffindor", born: 1980, married: true },
  { id: 2, name: "hermione", house: "gryffindor", born: 1979, married: false },
  { id: 3, name: "ron", house: "gryffindor", born: 1980, married: false },
  { id: 4, name: "draco", house: "slytherin", born: 1980, married: true },
];

const houses: House[] = [
  { id: "gryffindor", emblem: "lion" },
  { id: "hufflepuff", emblem: "badger" },
  { id: "ravenclaw", emblem: "eagle" },
  { id: "slytherin", emblem: "serpent" },
];

test("it parses an anonymous collection", () => {
  const db = new Database(wizards);
  expect(db.data).toEqual(wizards);
});

it("parses using a the MemoryAdapter", async () => {
  const adapter = new MemoryAdapter(houses);
  const db = new Database(adapter);
  await db.read();

  expect(db.data).toEqual(houses);
});
