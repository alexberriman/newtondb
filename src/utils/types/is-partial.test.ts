import { wizards } from "../../test-data";
import { isPartial } from "./is-partial";

test.each([
  [false, false],
  ["test", false],
  [undefined, false],
  [1, false],
  [[], false],
  [{ name: "harry" }, true],
  [{ id: 1, name: "harry" }, true],
  [{ id: 1, name: "harry", lorem: "ipsum" }, false],
])("isPartial(%s) is %s", (input, expected) => {
  const actual = isPartial(input, wizards[0]);
  expect(actual).toBe(expected);
});
