import { objectSubset } from "../utils/object";
import { isScalar, isSingleArray, objectOfProperties } from "../utils/types";

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
  properties?: StorageKeys[];
}

interface HashTableItem<Index, DataItem> {
  position: number;
  index: Index | string;
  data: DataItem;
}

// @todo move to util
function createHash(hash: unknown) {
  return typeof hash === "string" ? hash : JSON.stringify(hash);
}

// @todo move to util
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

  private createItem(item: Data) {
    const { keyBy, properties } = this.options;
    const index = keyBy
      ? (objectSubset(item, keyBy) as unknown as Index)
      : this.size.toString();
    const hash = createHash(index as string | Record<string, unknown>);
    const data =
      Array.isArray(properties) && properties.length > 0
        ? objectSubset(item, properties)
        : item;

    return { data, hash, index };
  }

  private getByHash(hash: string) {
    return (this.data[hash] ?? []).map(({ data }) => data);
  }

  insert(item: Data) {
    const { data, hash, index } = this.createItem(item);

    this.data[hash] = [
      ...(this.data[hash] ?? []),
      { position: this.size++, index, data: data as unknown as DataItem },
    ];
  }

  get(index: Index | number | string): DataItem[] {
    const { keyBy } = this.options;

    if (isScalar(index) && isSingleArray(keyBy)) {
      // have a single attribute for a key, can infer lookup key from scalar
      return this.getByHash(createHash({ [keyBy[0]]: index }));
    }

    return this.getByHash(
      createHash(index as string | number | Record<string, unknown>)
    );
  }

  private deleteByIndex(
    index: Index | string | number,
    predicate?: (item: DataItem) => boolean
  ) {
    const hash = createHash(index);
    if (this.data[hash]) {
      if (!predicate) {
        delete this.data[hash];
        // @todo re-order
      } else {
        const filteredItems = this.data[hash].filter(
          ({ data }) => !predicate(data)
        );

        if (filteredItems.length === 0) {
          delete this.data[hash];
          // @todo re-order
        } else {
          this.data[hash] = filteredItems;
          // @todo re-ordwer
        }
      }
    }
  }

  // delete by data item
  // delete by hash (optional predicate)

  delete(item: Data): void;
  delete(
    index: Index | string | number,
    predicate?: (item: DataItem) => boolean
  ): void;
  delete(
    itemOrIndex: Data | Index | string | number,
    predicate?: (item: DataItem) => boolean
  ) {
    const { keyBy = [] } = this.options;

    if (isScalar(itemOrIndex)) {
      if (isSingleArray(keyBy)) {
        // passed through a scalar (of which we can infer an index)
        return this.deleteByIndex(
          { [keyBy[0]]: itemOrIndex } as unknown as Index,
          predicate
        );
      }

      // delete by scalar
      return this.deleteByIndex(itemOrIndex, predicate);
    }

    if (objectOfProperties<Index>(itemOrIndex, keyBy as string[])) {
      // passed through an index
      return this.deleteByIndex(itemOrIndex, predicate);
    }

    // the entire data object was passed through, delete (can delete by data even if not indexed)
    const { index } = this.createItem(itemOrIndex);
    return this.deleteByIndex(index, predicate);
  }
}
