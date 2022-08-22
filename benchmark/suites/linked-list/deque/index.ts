import { add, complete, cycle, save, suite } from "benny";
import { Deque } from "@blakeembrey/deque";
import type { SaveOptions } from "benny/lib/internal/common-types";
import { createRecords, type Scientist } from "../../../helpers/faker";
import { rand } from "../../../helpers/rand";

function find(list: any, condition: any) {
  for (const item of list) {
    const $item = JSON.parse(item);
    if (condition($item)) {
      return item;
    }
  }

  return undefined;
}

export default (config: SaveOptions) =>
  suite(
    "linked-list: deque",
    add("1k records", () => {
      const records = createRecords(1000);
      const list = new Deque();
      records.forEach((record) => list.push(JSON.stringify(record)));

      return () => {
        const index = rand(0, records.length - 1);
        const target = records[index];
        find(list, (item: Scientist) => item.id === target.id);
      };
    }),

    add("10k records", () => {
      const records = createRecords(10000);
      const list = new Deque();
      records.forEach((record) => list.push(JSON.stringify(record)));

      return () => {
        const index = rand(0, records.length - 1);
        const target = records[index];
        find(list, (item: Scientist) => item.id === target.id);
      };
    }),

    add("100k records", () => {
      const records = createRecords(100000);
      const list = new Deque();
      records.forEach((record) => list.push(JSON.stringify(record)));

      return () => {
        const index = rand(0, records.length - 1);
        const target = records[index];
        find(list, (item: Scientist) => item.id === target.id);
      };
    }),

    add("1000k records", () => {
      const records = createRecords(1000000);
      const list = new Deque();
      records.forEach((record) => list.push(JSON.stringify(record)));

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
