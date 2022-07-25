import { add, complete, cycle, save, suite } from "benny";
import type { SaveOptions } from "benny/lib/internal/common-types";
import { Database } from "../../src";
import { createRecords, type Scientist } from "../helpers/faker";
import { rand } from "../helpers/rand";

export default (config: SaveOptions) => {
  const scientists = createRecords(1000000);

  suite(
    "`db.find` (1000k records)",

    add("**native** `Array.prototype.find()`", () => {
      const index = rand(0, scientists.length - 1);
      const target = scientists[index];

      scientists.find(({ id }) => id === target.id);
    }),

    add("**newton** without PK", () => {
      const db = new Database(scientists);

      return () => {
        const index = rand(0, scientists.length - 1);
        const target = scientists[index];

        db.$.find({ id: target.id }).data;
      };
    }),

    add("**newton** with pk", () => {
      const db = new Database<Scientist[]>(scientists, {
        collection: { primaryKey: "id" },
      });

      return () => {
        const index = rand(0, scientists.length - 1);
        const target = scientists[index];

        db.$.find({ id: target.id }).data;
      };
    }),

    cycle(),
    complete(),
    save({ ...config, file: "find" })
  );
};
