import { type AnyShape } from "../collection";
import { type Adapter, BaseAdapter } from "./adapter";

export class FileAdapter<T extends object = AnyShape>
  extends BaseAdapter
  implements Adapter<T>
{
  async read() {
    // @todo
    return {} as T;
  }

  write() {
    // @todo
    return Promise.resolve();
  }
}
