import { type AnyShape } from "../collection";
import { type Adapter, BaseAdapter } from "./adapter";

export class MemoryAdapter<T extends object = AnyShape>
  extends BaseAdapter
  implements Adapter<T>
{
  constructor(private data: T[]) {
    super();
  }

  async read() {
    return this.data as T[];
  }

  write() {
    // @todo
    return Promise.resolve();
  }
}
