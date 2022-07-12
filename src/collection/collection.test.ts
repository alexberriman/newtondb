// import { ConflictError } from "../errors/conflict-error";
import { AssertionError } from "../errors/assertion-error";
import { FindError } from "../errors/find-error";
import { extraWizards, Wizard, wizards } from "../test-data";
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
    const result = $.get(4);

    expect(result.data).toMatchObject({ id: 4, name: "draco" });
    expect(result.count).toBe(1);
    expect(result.exists).toBe(true);
  });

  it("returns correctly when value doesn't exist", () => {
    const $ = new Collection(wizards, { primaryKey: "id" });
    const result = $.get(-1);

    expect(result.data).toBeUndefined();
    expect(result.count).toBe(0);
    expect(result.exists).toBe(false);
  });

  it("returns from a basic query", () => {
    const $ = new Collection(wizards);
    expect($.get({ name: "draco", house: "slytherin" }).data).toMatchObject({
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
    const ron = $.get(({ name }: Wizard) => name === "ron").data;
    expect(ron).toMatchObject({ id: 3, name: "ron" });
  });

  it("gets by advanced condition", () => {
    const $ = new Collection(wizards);
    const ron = $.get({
      property: "name",
      operator: "equal",
      value: "ron",
    }).data;
    expect(ron).toMatchObject({ id: 3, name: "ron" });
  });

  it("gets using primary key", () => {
    const $ = new Collection(wizards, { primaryKey: ["house"] });
    const gryffindors = $.get({ house: "gryffindor" });

    expect(gryffindors.data).toMatchObject({
      born: 1980,
      house: "gryffindor",
      id: 1,
      married: true,
      name: "harry",
    });

    const slytherins = $.get("slytherin");
    expect(slytherins.data).toMatchObject({
      born: 1980,
      house: "slytherin",
      id: 4,
      married: true,
      name: "draco",
    });
  });
});

describe("find", () => {
  it("returns all rows by default", () => {
    const $ = new Collection(wizards);
    expect($.find().data).toHaveLength(wizards.length);
  });
  it("filters using a basic query", () => {
    const $ = new Collection([extraWizards.cho, ...wizards]);
    const gryffindors = $.find({ house: "gryffindor" });
    expect(gryffindors.data).toHaveLength(3);
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
  it("finds using primary key", () => {
    const $ = new Collection(wizards, { primaryKey: ["house"] });
    const gryffindors = $.find({ house: "gryffindor" });
    expect(gryffindors.data).toHaveLength(3);
    expect(gryffindors.data).toMatchObject([
      { id: 1, name: "harry" },
      { id: 2, name: "hermione" },
      { id: 3, name: "ron" },
    ]);
    const slytherins = $.find("slytherin");
    expect(slytherins.data).toHaveLength(1);
    expect(slytherins.data).toMatchObject([{ id: 4, name: "draco" }]);
  });
});

describe("assertion", () => {
  const $ = new Collection(wizards);

  it("continues when assertion passes", () => {
    expect($.get({ name: "harry" }).assert(({ data }) => !!data).data).toEqual(
      wizards[0]
    );
  });

  it("throws an error when assertion fails", () => {
    expect(() => {
      $.get({ name: "harry" }).assert(
        ({ data }) => (data as any)?.name === "ron"
      ).data;
    }).toThrow(AssertionError);
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

// describe("insert", () => {
//   // it("adds a record successfully", () => {
//   //   const $ = new Collection(wizards);
//   //   expect($.data).toHaveLength(4);
//   //   $.insert({
//   //     id: 5,
//   //     name: "neville",
//   //     house: "gryffindor",
//   //     born: 1980,
//   //     married: true,
//   //   });
//   //   expect($.data).toHaveLength(5);
//   // });

//   // eslint-disable-next-line jest/no-commented-out-tests
//   // it("returns an error when adding with the same id", () => {
//   //   // const $ = new Collection(wizards);
//   //   const $ = new Collection(wizards, { primaryKey: "id" });

//   //   expect(() => {
//   //     $.insert(wizards[0]);
//   //   }).toThrow(ConflictError);
//   // });

//   it("returns an error when data doesn't have valid id", () => {
//     // const $ = new Collection(wizards);

//     expect(1).toBe(1);
//   });

//   it("allows multiple values to be inserted", () => {
//     // const $ = new Collection(wizards);

//     expect(1).toBe(1);
//   });
// });

// describe("delete", () => {
//   it("deletes a subset", () => {
//     // const $ = new Collection(wizards, { primaryKey: ["id"] });
//     // expect($.data).toHaveLength(4);

//     // $.find({ house: "gryffindor", married: false })
//     //   .assert(({ count }) => count === 2)
//     //   .set()
//     //   .limit(100)
//     //   .delete()
//     //   .commit();

//     const $ = new Collection(wizards);
//     expect($.data).toHaveLength(4);

//     $.find({ married: false })
//       .assert(({ count }) => count === 2)
//       .set()
//       .limit(100)
//       .delete()
//       .commit();

//     // expect($.data).toHaveLength(3);
//     expect(1).toBe(1);
//   });
// });
