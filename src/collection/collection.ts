export class Collection<DataShape> {
  constructor(public data: DataShape[]) {}

  find(): DataShape[] {
    return [];
  }
}
