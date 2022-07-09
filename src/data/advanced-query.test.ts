import { houses, wizards } from "../test-data";
import { evaluate } from "./advanced-query";

describe("evaluate", () => {
  const [harry] = wizards;
  const [gryffindor] = houses;

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

  test("and condition", () => {
    expect(
      evaluate(
        {
          and: [
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
              and: [
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
          and: [
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

  test("or condition", () => {
    expect(
      evaluate(
        {
          or: [
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
              or: [
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
          or: [
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
});
