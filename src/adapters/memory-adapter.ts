import { BaseAdapter } from "./base-adapter";

export class MemoryAdapter<T> extends BaseAdapter<T> {
  constructor(public data: T) {
    super();
  }

  async read() {
    return this.data;
  }
}
