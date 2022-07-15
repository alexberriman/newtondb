import { Adapter, BaseAdapter } from "../adapters/base-adapter";
import { MemoryAdapter } from "../adapters/memory-adapter";
import { Collection } from "../collection/collection";
import { AdapterError } from "../errors/adapter-error";
import { NotReadyError } from "../errors/not-ready-error";
import { isArray, isObject } from "../utils/types";

type Db<T> = {
  [Property in keyof T]: T[Property] extends unknown[]
    ? Collection<T[Property][number]>
    : Collection<T[Property]>;
};

type Instance<T> = T extends unknown[] ? Collection<T[number]> : Db<T>;

type AllowedData = unknown[] | Record<string, unknown[]>;

export class Database<Shape extends AllowedData> {
  private instance?: Instance<Shape>;
  private adapter: BaseAdapter<Shape>;

  constructor(data: Shape);
  constructor(adapter: Adapter<Shape>);
  constructor(dataOrAdapter: BaseAdapter<Shape> | Shape) {
    function isAdapter<T>(value: unknown): value is T {
      return value instanceof BaseAdapter;
    }

    if (isAdapter<BaseAdapter<Shape>>(dataOrAdapter)) {
      this.adapter = dataOrAdapter;
    } else {
      this.adapter = new MemoryAdapter<Shape>(dataOrAdapter);
      if (typeof dataOrAdapter === "object") {
        // data passed through directly, can just read
        this.init(dataOrAdapter);
      }
    }
  }

  get $() {
    if (!this.instance) {
      throw new NotReadyError("Database not initialized. Call .read()");
    }

    return this.instance;
  }

  async read() {
    const data = await this.adapter.read();
    this.init(data);
  }

  private init(data: Shape) {
    if (isArray(data)) {
      this.instance = new Collection(data) as Instance<Shape>;
      return;
    } else if (
      isObject(data) &&
      Object.keys(data).every((key) => isArray(data[key]))
    ) {
      // create dictionary db
      this.instance = Object.keys(data).reduce(
        (obj, key) => ({ ...obj, [key]: new Collection(data[key]) }),
        {}
      ) as Instance<Shape>;
      return;
    }

    throw new AdapterError("Invalid format received from data source");
  }
}
