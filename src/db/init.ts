import { Adapter, BaseAdapter } from "../adapters/base-adapter";
import { MemoryAdapter } from "../adapters/memory-adapter";
import { Collection } from "../collection/collection";
import { AdapterError } from "../errors/adapter-error";
import { NotReadyError } from "../errors/not-ready-error";
import { WriteError } from "../errors/write-error";
import { isArray, isObject } from "../utils/types";
import {
  type Db,
  isCollection,
  isDatabase,
  type AllowedData,
  type Instance,
  type DatabaseOptions,
  type DatabaseCollectionOptions,
} from "./types";

export class Database<Shape extends AllowedData> {
  private instance?: Instance<Shape>;
  private adapter: BaseAdapter<Shape>;

  constructor(data: Shape, options?: DatabaseOptions<Shape>);
  constructor(adapter: Adapter<Shape>, options?: DatabaseOptions<Shape>);
  constructor(
    dataOrAdapter: BaseAdapter<Shape> | Shape,
    private options: DatabaseOptions<Shape> = {}
  ) {
    if (dataOrAdapter instanceof BaseAdapter) {
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

  get data(): Shape {
    const instance = this.$;

    if (isCollection<Collection<Shape>>(instance)) {
      return instance.data as Shape;
    } else if (isDatabase<Db<Shape>>(instance)) {
      return Object.keys(instance).reduce(
        (data, collectionName) => ({
          ...data,
          [collectionName]: instance[collectionName as keyof Shape].data,
        }),
        {}
      ) as Shape;
    }

    throw new WriteError("Unable to parse data");
  }

  async read() {
    const data = await this.adapter.read();
    this.init(data);
  }

  async write() {
    const result = await this.adapter.write(this.data);
    if (!result) {
      throw new WriteError("An error occurred when writing to the data source");
    }
  }

  private init(data: Shape) {
    const { collection = {} as DatabaseCollectionOptions<Shape> } =
      this.options;

    if (isArray(data)) {
      this.instance = new Collection(data, collection) as Instance<Shape>;
    } else if (
      isObject(data) &&
      Object.keys(data).every((key) => isArray(data[key]))
    ) {
      // create dictionary db
      this.instance = Object.keys(data).reduce(
        (obj: Partial<Instance<Shape>>, key: string) => ({
          ...obj,
          [key]: new Collection(
            data[key],
            collection[
              key as unknown as keyof DatabaseCollectionOptions<Shape>
            ] ?? {}
          ),
        }),
        {}
      ) as Instance<Shape>;
    } else {
      throw new AdapterError("Invalid format received from data source");
    }

    const { writeOnCommit = true } = this.options;
    if (writeOnCommit) {
      this.setUpAutoWrite();
    }
  }

  private setUpAutoWrite() {
    const instance = this.$;
    const collections = isCollection<Collection<Shape>>(instance)
      ? [this.instance]
      : Object.values(instance);

    collections.map((collection) =>
      (collection as Collection<unknown>).observe(() => {
        this.write();
      })
    );
  }
}
