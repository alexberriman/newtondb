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

    // data get's chained to subsequent operations
    expect(
      $.find({ house: "gryffindor" }).find({ house: "slytherin" }).data
    ).toHaveLength(0);
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

describe("attributes", () => {
  it("returns selected attributes", () => {
    const $ = new Collection(wizards);

    expect($.find({ house: "gryffindor" }).select(["id", "name"]).data).toEqual(
      [
        { id: 1, name: "harry" },
        { id: 2, name: "hermione" },
        { id: 3, name: "ron" },
      ]
    );

    expect($.get({ name: "hermione" }).select(["house", "name"]).data).toEqual({
      house: "gryffindor",
      name: "hermione",
    });
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

describe("delete", () => {
  it("deletes a subset but doesn't persist when change isn't committed", () => {
    const $ = new Collection(wizards, { primaryKey: "id" });
    expect($.data).toHaveLength(4);

    expect(() => {
      $.find({ house: "gryffindor" })
        .assert(
          "returned gryffindor students",
          ({ count, data }) =>
            count === 3 && data.every(({ house }) => house === "gryffindor")
        )
        .delete()
        .find()
        .assert(
          "no gryffindor students (have been deleted)",
          ({ count, data }) =>
            count === 1 && data.every(({ house }) => house !== "gryffindor")
        );
    }).not.toThrow(AssertionError);

    // mutations haven't been committed, so gryffindor students should be queryable still
    expect($.find({ house: "gryffindor" }).count).toBeGreaterThan(0);
  });

  it("deletes a subset and persists the change on commit", () => {
    const $ = new Collection([...wizards, ...Object.values(extraWizards)], {
      primaryKey: "id",
    });
    expect($.data).toHaveLength(6);

    const result = $.find({ name: "cho" })
      .delete()
      .find({ married: false })
      .delete()
      .commit();
    expect($.data).toMatchObject([
      { id: 1, name: "harry" },
      { id: 4, name: "draco" },
    ]);

    expect(result).toMatchObject({
      mutations: [
        { op: "remove", path: '/{"id":101}/5' },
        { op: "remove", path: '/{"id":2}/1' },
        { op: "remove", path: '/{"id":3}/2' },
        { op: "remove", path: '/{"id":100}/4' },
      ],
    });
  });
});

describe("insert", () => {
  it("inserts correctly to chain", () => {
    const $ = new Collection(wizards, { primaryKey: "house" });

    expect(
      $.insert(extraWizards.neville).find({ name: "neville" }).count
    ).toBeGreaterThan(0);
  });

  it("commits", () => {
    const $ = new Collection(wizards);
    expect($.find({ name: "neville" }).count).toBe(0);

    $.insert(extraWizards.neville).commit();
    expect($.find({ name: "neville" }).count).toBeGreaterThan(0);
  });
});

describe("set", () => {
  it("sets using a basic object", () => {
    const $ = new Collection(wizards, { copy: true, primaryKey: "house" });
    const condition = {
      property: "name",
      operator: "in",
      value: ["ron", "hermione"],
    };

    expect(() => {
      $.find(condition)
        .assert("Neither are married", ({ data }) =>
          data.every(({ married }) => married === false)
        )
        .set({ married: true })
        .commit();
    }).not.toThrow(AssertionError);

    expect($.find(condition).data).toMatchObject([
      { name: "hermione", married: true },
      { name: "ron", married: true },
    ]);
  });

  it("sets through complex chains", () => {
    const $ = new Collection(wizards, { copy: true });

    $.find({ name: "harry" })
      .select(["id", "house"])
      .delete()
      .find({ name: "draco" })
      .set({ wand: "elder wand" })
      .insert(extraWizards.neville)
      .find({ name: "ron" })
      .delete()
      .find({ wand: "elder wand" })
      .set({ name: "Draco Malfoy (with elder wand)" })
      .find({ married: false })
      .set({ married: true })
      .insert(extraWizards.cho)
      .commit();

    expect($.data).toMatchObject([
      { id: 2, name: "hermione", married: true },
      {
        id: 4,
        name: "Draco Malfoy (with elder wand)",
        married: true,
        wand: "elder wand",
      },
      { id: 100, name: "neville", married: true },
      { id: 101, name: "cho", married: true },
    ]);

    $.find({ house: "slytherin" })
      .set({ wand: "Hawthorn wood", name: "Draco Malfoy (lost the elder wand" })
      .commit();

    expect($.get({ house: "slytherin" }).data).toMatchObject({
      id: 4,
      name: "Draco Malfoy (lost the elder wand",
      house: "slytherin",
      born: 1980,
      married: true,
      wand: "Hawthorn wood",
    });
  });

  it("sets using a callback function", () => {
    const $ = new Collection(wizards, { copy: true });
    $.find({ house: "gryffindor" })
      .set((wizard) => ({ name: wizard.name.toUpperCase() }))
      .commit();

    expect($.data).toMatchObject([
      { id: 1, name: "HARRY" },
      { id: 2, name: "HERMIONE" },
      { id: 3, name: "RON" },
      { id: 4, name: "draco" },
    ]);
    expect(1).toBe(1);
  });
});

describe("replace", () => {
  it("updates using a new record", () => {
    const $ = new Collection(wizards, { copy: true });
    $.get({ id: 1 })
      .replace({ ...extraWizards.neville, id: 1 })
      .commit();

    expect($.get({ id: 1 }).data).toMatchObject({ id: 1, name: "neville" });
  });

  it("removes attributes", () => {
    const $ = new Collection<Wizard>([
      { ...extraWizards.neville, wand: "cherry and unicorn hair" },
    ]);

    expect($.get().data).toMatchObject({
      name: "neville",
      wand: "cherry and unicorn hair",
    });

    $.get().replace(extraWizards.neville).commit();

    expect($.get().data).not.toMatchObject({
      wand: "cherry and unicorn hair",
    });
  });

  it("updates using a function", () => {
    const $ = new Collection(wizards, { copy: true });
    $.find()
      .replace((item) => ({ ...item, wand: "standard wand" }))
      .commit();

    expect($.find().data).toMatchObject([
      { id: 1, wand: "standard wand" },
      { id: 2, wand: "standard wand" },
      { id: 3, wand: "standard wand" },
      { id: 4, wand: "standard wand" },
    ]);
  });
});
