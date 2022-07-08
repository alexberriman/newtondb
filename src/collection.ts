export type AnyShape = Record<string, unknown>;

export class Collection<T extends object = AnyShape> {
  constructor(private data: T) {}

  insert() {
    // do nothing
  }

  get() {
    // do nothing
  }

  find() {
    // do nothing
  }

  set() {
    // do nothing
  }

  delete() {
    // do nothing
  }

  patch() {
    // do nothing
  }

  createPatch() {
    // do nothing
  }

  expand() {
    // do nothing
  }

  sort() {
    // do nothing
  }

  limit() {
    // do nothing
  }

  offset() {
    // do nothing
  }

  observe() {
    // do nothing
  }

  unobserve() {
    // do nothing
  }
}
