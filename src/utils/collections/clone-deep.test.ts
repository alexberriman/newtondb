import { wizards } from "../../test-data";
import { cloneDeep } from "./clone-deep";

test("cloneDeep", () => {
  expect(wizards).toBe(wizards);
  const $wizards = cloneDeep(wizards);
  expect($wizards).not.toBe(wizards);
  expect($wizards).toEqual(wizards);
});
