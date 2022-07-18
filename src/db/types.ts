import { Collection, CollectionOptions } from "../collection/collection";
import { isObject } from "../utils/types";

export type Db<T> = {
  [Property in keyof T]: T[Property] extends unknown[]
    ? Collection<T[Property][number]>
    : Collection<T[Property]>;
};

export type Instance<T> = T extends unknown[] ? Collection<T[number]> : Db<T>;

export type AllowedData = unknown[] | Record<string, unknown[]>;

export type DbCollectionOptions<Shape> = {
  [Property in keyof Shape]: DatabaseCollectionOptions<Shape[Property]>;
};

export type DatabaseCollectionOptions<Shape> = Shape extends unknown[]
  ? CollectionOptions<keyof Shape[number]>
  : Partial<DbCollectionOptions<Shape>>;

export type DatabaseOptions<Shape> = {
  collection?: DatabaseCollectionOptions<Shape>;
  writeOnCommit?: boolean;
};

export function isCollection<T>(instance: unknown): instance is T {
  return !!instance && instance instanceof Collection;
}

export function isDatabase<T>(instance: unknown): instance is T {
  return (
    !!instance &&
    isObject(instance) &&
    Object.values(instance).every((v) => v instanceof Collection)
  );
}
