import { type AnyShape } from "../collection";

export interface Adapter<T extends object = AnyShape> {
  isAdapter: true;
  read: () => Promise<T[]>;
  write: () => Promise<void>;
}

export class BaseAdapter {
  public isAdapter: true = true;
}

export function isAdapter<T extends object = AnyShape>(
  o: unknown
): o is Adapter<T> {
  return typeof o === "object" && !!o && "isAdapter" in o;
}
