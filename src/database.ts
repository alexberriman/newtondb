import { Adapter, isAdapter } from "./adapters/adapter";
import { MemoryAdapter } from "./adapters/memory";
import { Collection, type AnyShape } from "./collection";

interface DatabaseOptions {}

// basic collection
// const db = new Database(data);
// db.$.find({ house: "slytherin" });

export class Database<T extends object = AnyShape> {
  private adapter: Adapter<T>;
  public data: T[] = [];
  private $: Collection | Record<keyof T, Collection> | null = null;

  constructor(data: T[], options?: DatabaseOptions);
  constructor(adapter: Adapter<T>, options?: DatabaseOptions);
  constructor(
    adapterOrData: T[] | Adapter<T>,
    private options?: DatabaseOptions
  ) {
    if (!isAdapter<T>(adapterOrData)) {
      this.adapter = new MemoryAdapter<T>(adapterOrData);
      this.data = adapterOrData;
      this.setUp();
    } else {
      this.adapter = adapterOrData;
    }
  }

  async read() {
    this.data = (await this.adapter.read()) as T[];
    this.setUp();
  }

  setUp() {
    const { data } = this;
    if (Array.isArray(data)) {
      // single collection was provided
      // console.log("array", data);
      // const collection = new Collection(data);
    } else {
      // db of collections was provided
      // console.log("db", data);
    }

    // console.log("data", data);
    this.data = data;
  }
}
