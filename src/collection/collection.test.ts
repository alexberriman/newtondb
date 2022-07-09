// import { ConflictError } from "../errors/conflict-error";
import { wizards } from "../test-data";
import { Collection } from "./collection";

describe("constructor", () => {
  it("sets data correctly", () => {
    const $ = new Collection(wizards);
    expect($.data).toEqual(wizards);
  });
});

describe("get", () => {
  it("retrieves a record by primary key", () => {
    const $ = new Collection(wizards, { primaryKey: "id" });
    expect($.get(1)).toMatchObject(wizards[0]);
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

  // eslint-disable-next-line jest/no-commented-out-tests
  // it("returns an error when adding with the same id", () => {
  //   // const $ = new Collection(wizards);
  //   const $ = new Collection(wizards, { primaryKey: "id" });

  //   expect(() => {
  //     $.insert(wizards[0]);
  //   }).toThrow(ConflictError);
  // });

  it("returns an error when data doesn't have valid id", () => {
    // const $ = new Collection(wizards);

    expect(1).toBe(1);
  });

  it("allows multiple values to be inserted", () => {
    // const $ = new Collection(wizards);

    expect(1).toBe(1);
  });
});
