import { Adapter, BaseAdapter } from "../adapters/base-adapter";
import { MemoryAdapter } from "../adapters/memory-adapter";
import { Collection } from "../collection/collection";
import type { GenericObserver, MutationEvent } from "../collection/observer";
import { AdapterError } from "../errors/adapter-error";
import { NotReadyError } from "../errors/not-ready-error";
import { ObserverError } from "../errors/observer-error";
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
  type DatabaseObserverCallback,
  type ValueOf,
  type DbObserverCallback,
  type DbObserverEvent,
} from "./types";

export class Database<Shape extends AllowedData> {
  private instance?: Instance<Shape>;
  private adapter: BaseAdapter<Shape>;
  private observers: Record<
    number,
    { collectionName?: string; collectionId: number }[]
  > = {};
  private observerCount = 0;

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
    if (this.adapter instanceof MemoryAdapter) {
      // pointless to write when using the memory adapter.
      // will lead to unnecessary computations
      return;
    }

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

  unobserve(id: number) {
    const observer = this.observers[id];
    if (!observer) {
      throw new ObserverError("Observer not found");
    }

    const instance = this.$;
    observer.forEach(({ collectionName, collectionId }) => {
      if (isCollection<Collection<Shape>>(instance)) {
        instance.unobserve(collectionId);
      } else if (collectionName) {
        const collection = (instance as Db<Shape>)[
          collectionName as keyof Shape
        ];

        collection.unobserve(collectionId);
      }
    });

    delete this.observers[id];
  }

  observe(callback: DatabaseObserverCallback<Shape>) {
    const instance = this.$;

    if (isCollection<Collection<Shape>>(instance)) {
      const collectionId = instance.observe(callback as GenericObserver<Shape>);
      this.observers[++this.observerCount] = [{ collectionId }];
    } else {
      this.observers[++this.observerCount] = Object.entries(
        instance as Db<Shape>
      ).map(([collectionName, collection]) => ({
        collectionName,
        collectionId: collection.observe(
          <T extends keyof Shape>(event: MutationEvent<unknown>) =>
            (callback as ValueOf<DbObserverCallback<Shape>>)(
              collectionName as T,
              event as DbObserverEvent<Shape, T>
            )
        ),
      }));
    }

    return this.observerCount;
  }
}
