export type AnyCollectionDataType = Record<string, unknown>;

export type AnyCollection = Collection<AnyCollectionDataType>;

export class Collection<DataShape extends AnyCollectionDataType> {
  find(): DataShape[] {
    return [];
  }
}
