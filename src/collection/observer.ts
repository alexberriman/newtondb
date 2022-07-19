import type { PatchResult } from "../data/hash-table/patch";
import { keyArrayBy } from "../utils/array";

export type ObserverEvent = "insert" | "update" | "delete" | "*";

export type InsertObserver<T> = (newRecord: T) => void;

export type UpdateObserver<T> = (
  updatedRecord: T,
  details: { old: T; new: T }
) => void;

export type DeleteObserver<T> = (deleted: T) => void;

export type GenericObserver<T> = (event: MutationEvent<T>) => void;

export type Observer<T> =
  | InsertObserver<T>
  | UpdateObserver<T>
  | DeleteObserver<T>
  | GenericObserver<T>;

export type Observers<T> = {
  insert: { id: number; callback: InsertObserver<T> }[];
  update: { id: number; callback: UpdateObserver<T> }[];
  delete: { id: number; callback: DeleteObserver<T> }[];
  "*": { id: number; callback: GenericObserver<T> }[];
};

export type InsertEvent<T> = { event: "insert"; data: T };

export type DeleteEvent<T> = { event: "delete"; data: T };

export type UpdateEvent<T> = { event: "updated"; data: { old: T; new: T } };

export type MutationEvent<T> = InsertEvent<T> | DeleteEvent<T> | UpdateEvent<T>;

export function shouldRaiseInsertEvent<T>(mutations: PatchResult<T>[]) {
  const [first] = mutations;
  const last = mutations[mutations.length - 1];

  return (
    first && last && first.operation === "add" && last.operation !== "remove"
  );
}

export function shouldRaiseDeleteEvent<T>(mutations: PatchResult<T>[]) {
  const [first] = mutations;
  const last = mutations[mutations.length - 1];

  return (
    first && last && first.operation === "remove" && last.operation !== "add"
  );
}

export function shouldRaiseUpdateEvent<T>(mutations: PatchResult<T>[]) {
  const [first] = mutations;
  const last = mutations[mutations.length - 1];

  return (
    first && last && first.operation !== "add" && last.operation !== "remove"
  );
}

export function createEvents<T>(
  mutations: PatchResult<T>[],
  getCurrentValue: ($id: string) => T
): MutationEvent<T>[] {
  const byId = keyArrayBy(mutations, "$id");

  return Object.entries(byId)
    .map(([$id, mutations]) => {
      const original = mutations[0]?.original ?? null;
      if (shouldRaiseInsertEvent(mutations)) {
        return { event: "insert", data: getCurrentValue($id) };
      }

      if (shouldRaiseDeleteEvent(mutations)) {
        return { event: "delete", data: original };
      }

      if (shouldRaiseUpdateEvent(mutations)) {
        const newValue = getCurrentValue($id);
        return {
          event: "updated",
          data: { old: original, new: newValue },
        };
      }

      return null;
    })
    .filter((event) => !!event) as MutationEvent<T>[];
}
