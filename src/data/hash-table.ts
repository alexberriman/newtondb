import { objectSubset } from "../utils/object";
import { isScalar } from "../utils/types";

interface HashTableOptions<IndexKeys, StorageKeys> {
  // need a key to generate a hash against for quick access
  // when a key is omitted, the array index will be used.
  keyBy?: IndexKeys[];

  // by default, the entire item will be stored against the hash
  // however, you can optionally pass through an array of keys
  // to store a subset of the data.
  //
  // this can be useful when creating secondary indexes and
  // you want to simply store the primary key against the
  // index rather than the entire piece of data
  attributes?: StorageKeys[];
}

interface HashTableItem<Index, DataItem> {
  position: number;
  index: Index | string;
  data: DataItem;
}

function createHash(hash: Record<string, unknown> | string | number) {
  return typeof hash === "string" ? hash : JSON.stringify(hash);
}

export class HashTable<
  Data,
  IndexKeys extends keyof Data,
  StorageKeys extends keyof Data = keyof Data,
  Index = Pick<Data, IndexKeys>,
  DataItem = Pick<Data, StorageKeys>
> {
  size = 0;
  data: Record<string, HashTableItem<Index, DataItem>[]> = {};

  constructor(
    items: Data[],
    public options: HashTableOptions<IndexKeys, StorageKeys> = {}
  ) {
    items.forEach(this.insert.bind(this));
  }

  insert(data: Data) {
    const { attributes, keyBy } = this.options;

    const index = keyBy
      ? (objectSubset(data, keyBy) as unknown as Index)
      : this.size.toString();
    const hash = createHash(index as string | Record<string, unknown>);

    const storage =
      Array.isArray(attributes) && attributes.length > 0
        ? objectSubset(data, attributes)
        : data;

    this.data[hash] = [
      ...(this.data[hash] ?? []),
      { position: this.size++, index, data: storage as unknown as DataItem },
    ];
  }

  private getByHash(hash: string) {
    return (this.data[hash] ?? []).map(({ data }) => data);
  }

  get(index: Index | unknown): DataItem[] {
    const { keyBy } = this.options;

    if (isScalar(index) && Array.isArray(keyBy) && keyBy.length === 1) {
      // have a single attribute for a key, can infer lookup key from scalar
      return this.getByHash(createHash({ [keyBy[0]]: index }));
    }

    return this.getByHash(
      createHash(index as string | number | Record<string, unknown>)
    );
  }
}
