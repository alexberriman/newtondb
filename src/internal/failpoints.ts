export type EngineFailpoint =
  | "delete:after-index-remove"
  | "delete:after-record-delete"
  | "delete:before-index-remove"
  | "delete:before-record-delete"
  | "insert:after-index-add"
  | "insert:after-record-write"
  | "insert:after-validation"
  | "insert:before-index-add"
  | "insert:before-record-write"
  | "insert:before-validation"
  | "transaction:before-publish"
  | "update:after-index-add"
  | "update:after-index-remove"
  | "update:after-record-write"
  | "update:after-validation"
  | "update:before-index-add"
  | "update:before-index-remove"
  | "update:before-record-write"
  | "update:before-validation";

let handler: ((failpoint: EngineFailpoint) => void) | undefined;

export function reachEngineFailpoint(failpoint: EngineFailpoint): void {
  handler?.(failpoint);
}

/** Test-only hook; this module is not part of any package export. */
export function setEngineFailpointHandler(
  next: ((failpoint: EngineFailpoint) => void) | undefined,
): void {
  handler = next;
}
