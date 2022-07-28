import { wizards } from "../../test-data";
import { keyBy } from "./key-by";

test("keyBy", () => {
  const $wizards = keyBy(wizards, "id");
  expect($wizards).toMatchObject({
    1: wizards[0],
    2: wizards[1],
    3: wizards[2],
    4: wizards[3],
  });
});
