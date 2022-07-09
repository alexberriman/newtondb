import { wizards } from "../test-data";
import { get, query } from "./basic-query";

describe("query()", () => {
  it("returns a subset of results when query is matched", () => {
    expect(query(wizards, { name: "draco" })).toEqual([
      { id: 4, name: "draco", house: "slytherin", born: 1980, married: true },
    ]);
  });

  it("returns multiple", () => {
    expect(query(wizards, { house: "gryffindor" })).toEqual([
      { id: 1, name: "harry", house: "gryffindor", born: 1980, married: true },
      {
        id: 2,
        name: "hermione",
        house: "gryffindor",
        born: 1979,
        married: false,
      },
      { id: 3, name: "ron", house: "gryffindor", born: 1980, married: false },
    ]);
  });

  it("returns an empty array when no results found", () => {
    expect(query(wizards, { house: "ravenclaw" })).toEqual([]);
  });

  it("returns an empty array when junk data is provided", () => {
    expect(query(wizards, { lorem: "ipsum" } as any)).toEqual([]);
  });
});

describe("get()", () => {
  it("returns the first entity when exists", () => {
    expect(get(wizards, { house: "gryffindor" })).toEqual({
      id: 1,
      name: "harry",
      house: "gryffindor",
      born: 1980,
      married: true,
    });
  });

  it("returns undefined when doesn't exist", () => {
    expect(get(wizards, { lorem: "ipsum" } as any)).toBeUndefined();
  });
});
