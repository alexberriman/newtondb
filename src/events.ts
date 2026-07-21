import type { JsonObject, ReadonlyDeep } from "./json.js";

export type ChangeOperation = "delete" | "insert" | "update";

export interface Change<T extends JsonObject = JsonObject> {
  readonly after?: ReadonlyDeep<T>;
  readonly before?: ReadonlyDeep<T>;
  readonly collection: string;
  readonly operation: ChangeOperation;
  readonly primaryKey: number | string;
}

export interface ChangeBatch {
  readonly changes: readonly Change[];
  readonly databaseId: string;
  readonly revision: number;
  readonly transactionId: string;
}

export type ChangeListener = (batch: ChangeBatch) => void;
