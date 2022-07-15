type BasePatchResult<T> = {
  $id: number;
  original: T | null;
};

export type RemoveAttributeResult<T> = BasePatchResult<T> & {
  operation: "removeAttribute";
  attribute: string;
};

export type RemoveResult<T> = BasePatchResult<T> & {
  operation: "remove";
  value: T;
};

export type AddAttributeResult<T> = BasePatchResult<T> & {
  operation: "addAttribute";
  attribute: string;
  value: unknown;
};

export type AddResult<T> = BasePatchResult<T> & {
  operation: "add";
  value: T;
};

export type ReplaceResult<T> = BasePatchResult<T> & {
  operation: "replaceAttribute";
  attribute: string;
  value: unknown;
  oldValue: unknown;
};

export type PatchRemoveResult<T> = RemoveAttributeResult<T> | RemoveResult<T>;

export type PatchAddResult<T> = AddAttributeResult<T> | AddResult<T>;

export type PatchError = null;

export type PatchResult<T> =
  | PatchRemoveResult<T>
  | PatchAddResult<T>
  | ReplaceResult<T>
  | PatchError;
