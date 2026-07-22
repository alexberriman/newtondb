import { Database, collectionSchema } from "newtondb";

class VolatileAdapter {
  snapshot = null;
  async load() {
    return this.snapshot;
  }
  async store(snapshot, { expectedGeneration }) {
    if ((this.snapshot?.generation ?? 0) !== expectedGeneration) {
      throw new Error("generation conflict");
    }
    this.snapshot = globalThis.structuredClone(snapshot);
    return {
      databaseId: snapshot.databaseId,
      generation: snapshot.generation,
      revision: snapshot.revision,
    };
  }
  close() {
    return Promise.resolve();
  }
}

const adapter = new VolatileAdapter();
const database = await Database.open({
  adapter,
  initialData: { records: [] },
  schema: { records: collectionSchema({ primaryKey: "id" }) },
});
await database.collection("records").insert({ id: "one", value: true });
if (adapter.snapshot?.revision !== 1) throw new Error("adapter example failed");
await database.close();
