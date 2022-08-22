import { add, complete, cycle, save, suite } from "benny";
import Fifo from "fifo";
import type { SaveOptions } from "benny/lib/internal/common-types";
import { createRecords, type Scientist } from "../../../helpers/faker";
import { rand } from "../../../helpers/rand";

function find(list: any, condition: any) {
  let $node: Scientist | undefined = undefined;
  try {
    list.forEach((item: Scientist) => {
      if (condition(item)) {
        $node = item;
        throw new Error();
      }
    });
  } catch (e) {
    return $node;
  }

  return undefined;
}

export default (config: SaveOptions) =>
  suite(
    "linked-list: deque",
    add("1k records", () => {
      const records = createRecords(1000);
      const list = new Fifo();
      records.forEach((record) => list.push(record));

      return () => {
        const index = rand(0, records.length - 1);
        const target = records[index];
        find(list, (item: Scientist) => item.id === target.id);
      };
    }),

    add("10k records", () => {
      const records = createRecords(10000);
      const list = new Fifo();
      records.forEach((record) => list.push(record));

      return () => {
        const index = rand(0, records.length - 1);
        const target = records[index];
        find(list, (item: Scientist) => item.id === target.id);
      };
    }),

    add("100k records", () => {
      const records = createRecords(100000);
      const list = new Fifo();
      records.forEach((record) => list.push(record));

      return () => {
        const index = rand(0, records.length - 1);
        const target = records[index];
        find(list, (item: Scientist) => item.id === target.id);
      };
    }),

    add("1000k records", () => {
      const records = createRecords(1000000);
      const list = new Fifo();
      records.forEach((record) => list.push(record));

      return () => {
        const index = rand(0, records.length - 1);
        const target = records[index];
        find(list, (item: Scientist) => item.id === target.id);
      };
    }),

    cycle(),
    complete(),
    save({ ...config, file: "instantiating" })
  );
