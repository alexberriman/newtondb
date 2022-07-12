import { houses, wizards } from "../../test-data";
import { evaluate, getProperty } from "./query";

const [harry] = wizards;
const [gryffindor] = houses;

describe("getProperty", () => {
  const obj = harry as unknown as Record<string, unknown>;

  test("basic string property", () => {
    expect(getProperty(obj, "house")).toBe("gryffindor");
  });

  test("basic nested property", () => {
    expect(getProperty(obj, { name: "house" })).toBe("gryffindor");
  });

  test("with preprocessors", () => {
    expect(getProperty(obj, { name: "house", preProcess: ["toUpper"] })).toBe(
      "GRYFFINDOR"
    );

    expect(
      getProperty(obj, { name: "house", preProcess: ["toUpper", "toLower"] })
    ).toBe("gryffindor");

    expect(
      getProperty(obj, {
        name: "house",
        preProcess: [
          { fn: "toLower" },
          "toUpper",
          { fn: "concat", args: ["_test", "1"] },
          { fn: "substring", args: [1] },
        ],
      })
    ).toBe("RYFFINDOR_test1");
  });

  test("nested properties", () => {
    expect(
      getProperty(obj, {
        name: "name",
        preProcess: [
          "toUpper",
          {
            fn: "substring",
            args: [1, 4],
          },
          {
            fn: "concat",
            args: ["_"],
          },
          {
            fn: "concat",
            args: [
              {
                name: "house",
                preProcess: [{ fn: "substring", args: [0, 5] }],
              },
              "|",
              {
                name: "house",
                preProcess: [
                  {
                    fn: "substring",
                    args: [1, 4],
                  },
                  "toUpper",
                ],
              },
            ],
          },
        ],
      })
    ).toBe("ARR_gryff|RYF");
  });
});

describe("evaluate", () => {
  test("equal operator", () => {
    expect(
      evaluate({ property: "name", operator: "equal", value: "harry" }, harry)
    ).toBe(true);

    expect(
      evaluate({ property: "name", operator: "equal", value: "neville" }, harry)
    ).toBe(false);
  });

  test("notEqual operator", () => {
    expect(
      evaluate(
        { property: "name", operator: "notEqual", value: "harry" },
        harry
      )
    ).toBe(false);

    expect(
      evaluate(
        { property: "name", operator: "notEqual", value: "neville" },
        harry
      )
    ).toBe(true);
  });

  test("startsWith operator", () => {
    expect(
      evaluate({ property: "name", operator: "startsWith", value: "ha" }, harry)
    ).toBe(true);

    expect(
      evaluate({ property: "name", operator: "startsWith", value: "ne" }, harry)
    ).toBe(false);
  });

  test("endsWith operator", () => {
    expect(
      evaluate({ property: "name", operator: "endsWith", value: "rry" }, harry)
    ).toBe(true);

    expect(
      evaluate({ property: "name", operator: "endsWith", value: "lle" }, harry)
    ).toBe(false);
  });

  test("matchesRegex operator", () => {
    expect(
      evaluate(
        { property: "name", operator: "matchesRegex", value: "^[a-z]+$" },
        harry
      )
    ).toBe(true);

    expect(
      evaluate(
        { property: "name", operator: "matchesRegex", value: "^[0-9]+$" },
        harry
      )
    ).toBe(false);
  });

  test("doesNotMatchRegex operator", () => {
    expect(
      evaluate(
        { property: "name", operator: "doesNotMatchRegex", value: "^[a-z]+$" },
        harry
      )
    ).toBe(false);

    expect(
      evaluate(
        { property: "name", operator: "doesNotMatchRegex", value: "^[0-9]+$" },
        harry
      )
    ).toBe(true);
  });

  test("lessThan operator", () => {
    expect(
      evaluate({ property: "born", operator: "lessThan", value: 2000 }, harry)
    ).toBe(true);

    expect(
      evaluate({ property: "born", operator: "lessThan", value: 1000 }, harry)
    ).toBe(false);
  });

  test("lessThanInclusive operator", () => {
    expect(
      evaluate(
        { property: "born", operator: "lessThanInclusive", value: 1980 },
        harry
      )
    ).toBe(true);

    expect(
      evaluate(
        { property: "born", operator: "lessThanInclusive", value: 1981 },
        harry
      )
    ).toBe(true);

    expect(
      evaluate(
        { property: "born", operator: "lessThanInclusive", value: 1000 },
        harry
      )
    ).toBe(false);
  });

  test("in operator", () => {
    expect(
      evaluate(
        { property: "name", operator: "in", value: ["ron", "harry"] },
        harry
      )
    ).toBe(true);

    expect(
      evaluate({ property: "name", operator: "in", value: ["draco"] }, harry)
    ).toBe(false);

    expect(
      evaluate({ property: "lorem", operator: "in", value: ["draco"] }, harry)
    ).toBe(false);
  });

  test("notIn operator", () => {
    expect(
      evaluate(
        { property: "name", operator: "notIn", value: ["ron", "harry"] },
        harry
      )
    ).toBe(false);

    expect(
      evaluate({ property: "name", operator: "notIn", value: ["draco"] }, harry)
    ).toBe(true);

    expect(
      evaluate(
        { property: "lorem", operator: "notIn", value: ["draco"] },
        harry
      )
    ).toBe(true);
  });

  test("contains operator", () => {
    expect(
      evaluate({ property: "name", operator: "contains", value: "ha" }, harry)
    ).toBe(true);

    expect(
      evaluate({ property: "name", operator: "contains", value: "zz" }, harry)
    ).toBe(false);

    expect(
      evaluate(
        {
          property: "headmasters",
          operator: "contains",
          value: "albus dumbledore",
        },
        gryffindor
      )
    ).toBe(true);

    expect(
      evaluate(
        {
          property: "headmasters",
          operator: "contains",
          value: "severus snape",
        },
        gryffindor
      )
    ).toBe(false);
  });

  test("doesNotContain operator", () => {
    expect(
      evaluate(
        { property: "name", operator: "doesNotContain", value: "ha" },
        harry
      )
    ).toBe(false);

    expect(
      evaluate(
        { property: "name", operator: "doesNotContain", value: "zz" },
        harry
      )
    ).toBe(true);

    expect(
      evaluate(
        {
          property: "headmasters",
          operator: "doesNotContain",
          value: "albus dumbledore",
        },
        gryffindor
      )
    ).toBe(false);

    expect(
      evaluate(
        {
          property: "headmasters",
          operator: "doesNotContain",
          value: "severus snape",
        },
        gryffindor
      )
    ).toBe(true);
  });

  test("every condition", () => {
    expect(
      evaluate(
        {
          every: [
            {
              property: "house",
              operator: "equal",
              value: "gryffindor",
            },
            {
              property: "born",
              operator: "notEqual",
              value: 1000,
            },
            {
              every: [
                { property: "name", operator: "in", value: ["harry", "ron"] },
                { property: "married", operator: "equal", value: true },
              ],
            },
          ],
        },
        harry
      )
    ).toBe(true);

    expect(
      evaluate(
        {
          every: [
            {
              property: "house",
              operator: "equal",
              value: "gryffindor",
            },
            {
              property: "born",
              operator: "equal",
              value: 1000,
            },
          ],
        },
        harry
      )
    ).toBe(false);
  });

  test("some condition", () => {
    expect(
      evaluate(
        {
          some: [
            {
              property: "house",
              operator: "equal",
              value: "slytherin",
            },
            {
              property: "born",
              operator: "equal",
              value: 1000,
            },
            {
              some: [
                {
                  property: "name",
                  operator: "in",
                  value: ["hermione", "ron"],
                },
                { property: "married", operator: "equal", value: true },
              ],
            },
          ],
        },
        harry
      )
    ).toBe(true);

    expect(
      evaluate(
        {
          some: [
            {
              property: "house",
              operator: "equal",
              value: "slytherin",
            },
            {
              property: "born",
              operator: "equal",
              value: 1000,
            },
          ],
        },
        harry
      )
    ).toBe(false);
  });

  it("doesn't coerce values", () => {
    expect(
      evaluate(
        { property: { name: "born" }, operator: "equal", value: "1980" },
        harry
      )
    ).toBe(false);

    expect(
      evaluate(
        { property: { name: "born" }, operator: "equal", value: 1980 },
        harry
      )
    ).toBe(true);
  });

  it("evaluates nested properties", () => {
    expect(
      evaluate(
        { property: { name: "house" }, operator: "equal", value: "gryffindor" },
        harry
      )
    ).toBe(true);
  });

  it("evaluates with preprocessors", () => {
    expect(
      evaluate(
        {
          property: { name: "house", preProcess: ["toUpper"] },
          operator: "equal",
          value: "GRYFFINDOR",
        },
        harry
      )
    ).toBe(true);
  });
});
