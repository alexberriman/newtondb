import { extraWizards, wizards } from "../../test-data";
import { isEqual } from "./is-equal";

describe("isEqual", () => {
  it("is equal for basic object", () => {
    expect(
      isEqual(extraWizards.neville, {
        id: 100,
        name: "neville",
        house: "gryffindor",
        born: 1980,
        married: false,
      })
    ).toBe(true);
  });

  it("is deeply equal when properties are out of order", () => {
    expect(
      isEqual(extraWizards.neville, {
        name: "neville",
        id: 100,
        house: "gryffindor",
        born: 1980,
        married: false,
      })
    ).toBe(true);
  });

  it("is deeply equal", () => {
    const input = { defaultWizards: wizards, extraWizards };
    expect(isEqual(input, input)).toBe(true);
  });

  it("is equal for scalars", () => {
    expect(isEqual(true, false)).toBe(false);
    expect(isEqual(true, true)).toBe(true);
  });
});
