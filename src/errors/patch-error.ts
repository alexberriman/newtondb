import { PatchOperation } from "../data/json-patch";

export class PatchError extends Error {
  constructor(public patch: PatchOperation, message: string) {
    super(message);

    this.name = "PatchError";
  }
}
