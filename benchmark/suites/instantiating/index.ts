import { add, complete, cycle, save, suite } from "benny";
import type { SaveOptions } from "benny/lib/internal/common-types";
import { Database } from "../../../src";
import { createRecords } from "../../helpers/faker";

export default (config: SaveOptions) =>
  suite(
    "`new Newton()`",
    add("1k records", () => {
      const records = createRecords(1000);

      return () => {
        new Database(records);
      };
    }),

    add("10k records", () => {
      const records = createRecords(10000);

      return () => {
        new Database(records);
      };
    }),

    add("100k records", () => {
      const records = createRecords(100000);

      return () => {
        new Database(records);
      };
    }),

    add("1000k records", () => {
      const records = createRecords(1000000);

      return () => {
        new Database(records);
      };
    }),

    cycle(),
    complete(),
    save({ ...config, file: "instantiating" })
  );
