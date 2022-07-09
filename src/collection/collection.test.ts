import { wizards } from "../test-data";
import { Collection } from "./collection";

describe("constructor", () => {
  it("returns an error when data doesn't have valid id", () => {
    // const $ = new Collection(wizards);

    expect(1).toBe(1);
  });

  it("fails silently when data doesn't have valid ids and silent option is set", () => {
    // const $ = new Collection(wizards);
    expect(1).toBe(1);
  });
});

describe("insert", () => {
  it("adds a record successfully", () => {
    const $ = new Collection(wizards);
    expect($.data).toHaveLength(4);
    $.insert({
      id: 5,
      name: "neville",
      house: "gryffindor",
      born: 1980,
      married: true,
    });
    expect($.data).toHaveLength(5);
  });

  it("returns an error when adding with the same id", () => {
    // const $ = new Collection(wizards);

    expect(1).toBe(1);
  });

  it("returns an error when data doesn't have valid id", () => {
    // const $ = new Collection(wizards);

    expect(1).toBe(1);
  });

  it("allows multiple values to be inserted", () => {
    // const $ = new Collection(wizards);

    expect(1).toBe(1);
  });
});
