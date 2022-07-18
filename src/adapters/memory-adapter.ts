import { WriteError } from "../errors/write-error";
import { BaseAdapter } from "./base-adapter";

export class MemoryAdapter<T> extends BaseAdapter<T> {
  constructor(public data: T) {
    super();
  }

  async read() {
    return this.data;
  }

  async write(): Promise<boolean> {
    throw new WriteError("MemoryAdapter has no .write method");
  }
}
