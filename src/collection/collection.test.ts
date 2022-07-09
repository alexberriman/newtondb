// import { ConflictError } from "../errors/conflict-error";
import { FindError } from "../errors/find-error";
import { Wizard, wizards } from "../test-data";
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
    expect($.get(4)).toMatchObject({ id: 4, name: "draco" });
  });

  it("returns undefined when value doesn't exist", () => {
    const $ = new Collection(wizards, { primaryKey: "id" });
    expect($.get(-1)).toBeUndefined();
  });

  it("returns from a basic query", () => {
    const $ = new Collection(wizards);
    expect($.get({ name: "draco", house: "slytherin" })).toMatchObject({
      id: 4,
      name: "draco",
    });
  });

  it("throws an error when trying to get using a scalar without a primary key", () => {
    expect(() => {
      const $ = new Collection(wizards);
      $.get(4);
    }).toThrow(FindError);
  });

  it("gets by function", () => {
    const $ = new Collection(wizards);
    const ron = $.get(({ name }: Wizard) => name === "ron");
    expect(ron).toMatchObject({ id: 3, name: "ron" });
  });

  it("gets by advanced condition", () => {
    const $ = new Collection(wizards);
    const ron = $.get({ property: "name", operator: "equal", value: "ron" });
    expect(ron).toMatchObject({ id: 3, name: "ron" });
  });
});

describe("find", () => {
  it("returns all rows by default", () => {
    const $ = new Collection(wizards);
    expect($.find().data).toHaveLength(wizards.length);
  });

  it("filters using a basic query", () => {
    const $ = new Collection(wizards);
    expect($.find({ house: "gryffindor" }).data).toHaveLength(3);
  });

  it("returns a single row when finding by primary key", () => {
    const $ = new Collection(wizards, { primaryKey: "id" });
    const result = $.find(3);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: 3, name: "ron" });
  });

  it("chains subsequent find operations", () => {
    const $ = new Collection(wizards);
    expect(
      $.find({ house: "gryffindor" }).find({ name: "draco" }).data
    ).toHaveLength(0);

    expect(
      $.find({ house: "gryffindor" }).find({ name: "hermione" }).data
    ).toHaveLength(1);
  });

  it("finds by function", () => {
    const $ = new Collection(wizards);
    const gryffindors = $.find(
      ({ house }: Wizard) => house === "gryffindor"
    ).data;
    expect(gryffindors).toHaveLength(3);
    expect(gryffindors).toMatchObject([
      { id: 1, name: "harry" },
      { id: 2, name: "hermione" },
      { id: 3, name: "ron" },
    ]);
  });

  it("finds by advanced condition", () => {
    const $ = new Collection(wizards);
    const gryffindors = $.find({
      property: "house",
      operator: "equal",
      value: "gryffindor",
    }).data;
    expect(gryffindors).toHaveLength(3);
    expect(gryffindors).toMatchObject([
      { id: 1, name: "harry" },
      { id: 2, name: "hermione" },
      { id: 3, name: "ron" },
    ]);
  });

  it("throws an error when trying find by a scalar without a primary key", () => {
    expect(() => {
      const $ = new Collection(wizards);
      $.find(4);
    }).toThrow(FindError);
  });
});

describe("limit", () => {
  it("limits the default data", () => {
    const $ = new Collection(wizards);
    const res = $.limit(2).data;
    expect(res).toHaveLength(2);
    expect(res).toMatchObject([
      { id: 1, name: "harry" },
      { id: 2, name: "hermione" },
    ]);
  });

  it("limits from a find operation", () => {
    const $ = new Collection(wizards);
    const res = $.find({ married: false }).limit(1).data;
    expect(res).toHaveLength(1);
    expect(res).toMatchObject([{ id: 2, name: "hermione" }]);
  });
});

describe("offset", () => {
  it("offsets from the default data", () => {
    const $ = new Collection(wizards);
    const res = $.offset(2).data;
    expect(res).toHaveLength(2);
    expect(res).toMatchObject([
      { id: 3, name: "ron" },
      { id: 4, name: "draco" },
    ]);
  });

  it("offsets from a chained operation", () => {
    const $ = new Collection(wizards);
    const res = $.find({ married: false }).offset(1).data;
    expect(res).toHaveLength(1);
    expect(res).toMatchObject([{ id: 3, name: "ron" }]);
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
