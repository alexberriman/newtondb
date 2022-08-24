import { readFile, writeFile } from "fs/promises";
import { AdapterError } from "../errors";
import { BaseAdapter } from "./base-adapter";

export class FileAdapter<T> extends BaseAdapter<T> {
  constructor(protected fileName: string) {
    super();
  }

  async read() {
    let result: string;
    try {
      result = (await readFile(this.fileName)).toString();
    } catch (e) {
      throw new AdapterError(`Unable to load file: ${this.fileName}`);
    }

    try {
      return JSON.parse(result.toString());
    } catch (e) {
      throw new AdapterError("Unable to parse JSON in data source");
    }
  }

  async write(data: T): Promise<boolean> {
    try {
      await writeFile(this.fileName, JSON.stringify(data));
    } catch (e) {
      throw new AdapterError("Unable to write data to destination");
    }

    return true;
  }
}
