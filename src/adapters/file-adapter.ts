import { readFile, writeFile } from "fs/promises";
import { BaseAdapter } from "./base-adapter";

export class FileAdapter<T> extends BaseAdapter<T> {
  constructor(protected fileName: string) {
    super();
  }

  async read() {
    const result = await readFile(this.fileName);
    return JSON.parse(result.toString());
  }

  async write(data: T): Promise<boolean> {
    await writeFile(this.fileName, JSON.stringify(data));
    return true;
  }
}
