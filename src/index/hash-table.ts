import { objectSubset } from "../utils/object";

interface HashTableOptions<T> {
  index: (keyof T)[];
  item?: (o: T) => Partial<T>;
}

type HashTableData<T> = Record<string, Partial<T>[]>;

export type HashTable<T> = {
  data: HashTableData<T>;
  options: HashTableOptions<T>;
};

function createHash(hash: Record<string, unknown> | string) {
  return typeof hash === "string" ? hash : JSON.stringify(hash);
}

function shallowClone<T>(input: HashTable<T>) {
  return { ...input, data: { ...input.data } };
}

function insertItem<T>(
  data: HashTableData<T>,
  item: T,
  options: HashTableOptions<T>
) {
  const hash = createHash(
    objectSubset(item as Record<string, unknown>, options.index as string[])
  );

  return {
    ...data,
    [hash]: [...(data[hash] ?? []), options.item ? options.item(item) : item],
  };
}

export function createHashTable<T>(data: T[], options: HashTableOptions<T>) {
  const hashTable = data.reduce(
    (table: HashTableData<T>, o) => insertItem(table, o, options),
    {}
  );

  return { options, data: hashTable };
}

export function get<T>(table: HashTable<T>, hash: Partial<T> | string) {
  return table.data[createHash(hash)] ?? [];
}

export function deleteItem<T>(table: HashTable<T>, hash: Partial<T> | string) {
  const updatable = shallowClone(table);
  delete updatable.data[createHash(hash)];

  return updatable;
}

export function insert<T>(table: HashTable<T>, item: T) {
  const updatable = shallowClone(table);
  updatable.data = insertItem(updatable.data, item, updatable.options);

  return updatable;
}
