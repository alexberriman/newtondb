export interface Adapter<T> {
  read(): Promise<T>;
}

export abstract class BaseAdapter<T> implements Adapter<T> {
  abstract read(): Promise<T>;
  abstract write(data: T): Promise<boolean>;
}
