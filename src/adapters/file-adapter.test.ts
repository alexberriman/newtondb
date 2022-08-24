import { readFile, writeFile } from "fs/promises";

import { Database } from "../db/init";
import { AdapterError } from "../errors";
import type { Wizard } from "../test-data";
import { FileAdapter } from "./file-adapter";

jest.mock("fs/promises", () => ({
  readFile: jest.fn().mockReturnValue(
    JSON.stringify({
      wizards: [
        {
          id: 1,
          name: "harry",
          house: "gryffindor",
          born: 1980,
          married: true,
        },
        {
          id: 2,
          name: "hermione",
          house: "gryffindor",
          born: 1979,
          married: false,
        },
        { id: 3, name: "ron", house: "gryffindor", born: 1980, married: false },
        { id: 4, name: "draco", house: "slytherin", born: 1980, married: true },
      ],
    })
  ),
  writeFile: jest.fn(),
}));

const writeFileMock = writeFile as jest.Mock;
const readFileMock = readFile as jest.Mock;

type Schema = { wizards: Wizard[] };

describe("fileAdapter", () => {
  beforeEach(() => {
    readFileMock.mockClear();
    writeFileMock.mockClear();
  });

  describe(".read", () => {
    it("loads correctly", async () => {
      const db = new Database<Schema>(new FileAdapter("./example.json"));
      await db.read();

      expect(db.$.wizards.data).toHaveLength(4);
    });

    it("saves on delete", async () => {
      const db = new Database<Schema>(new FileAdapter("./example.json"));
      await db.read();

      db.$.wizards.get({ name: "ron" }).delete().commit();
      expect(db.$.wizards.data).toHaveLength(3);
      expect(writeFileMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalledWith(
        "./example.json",
        JSON.stringify({ wizards: db.$.wizards.data })
      );
    });

    it("saves on update", async () => {
      const db = new Database<Schema>(new FileAdapter("./example.json"));
      await db.read();
      db.$.wizards
        .get({ name: "harry" })
        .set({ name: "Harry Potter" })
        .commit();

      const { data } = db.$.wizards.find();
      expect(data).toHaveLength(4);
      expect(data[0]).toMatchObject({ name: "Harry Potter" });

      expect(writeFileMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalledWith(
        "./example.json",
        JSON.stringify({ wizards: data })
      );
    });

    it("throws an error when the file doesn't exist", async () => {
      readFileMock.mockRejectedValueOnce(new Error());
      const db = new Database<Schema>(new FileAdapter("./example.json"));
      await expect(db.read()).rejects.toThrow(
        new AdapterError("Unable to load file: ./example.json")
      );
    });

    it("throws an error when it can't parse the json", async () => {
      readFileMock.mockReturnValueOnce("{_a#");
      const db = new Database<Schema>(new FileAdapter("./example.json"));
      await expect(db.read()).rejects.toThrow(
        new AdapterError("Unable to parse JSON in data source")
      );
    });
  });

  describe(".write", () => {
    it("throws an error when it can't write to the destination", async () => {
      writeFileMock.mockRejectedValueOnce(new Error());

      const db = new Database<Schema>(new FileAdapter("./example.json"));
      await db.read();
      await expect(db.write()).rejects.toThrow(
        new AdapterError("Unable to write data to destination")
      );
    });
  });
});
