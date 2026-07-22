import { Database, collectionSchema, where } from "newtondb";

const schema = {
  planets: collectionSchema({
    indexes: [{ name: "by-kind", path: ["kind"] }],
    primaryKey: "id",
  }),
};
const database = Database.memory(
  {
    planets: [
      { id: "earth", kind: "rocky", moons: 1 },
      { id: "saturn", kind: "gas", moons: 146 },
    ],
  },
  { schema },
);

const rocky = database
  .collection("planets")
  .findMany(where().eq("kind", "rocky"));
if (rocky[0]?.id !== "earth" || !Object.isFrozen(rocky[0])) {
  throw new Error("memory example failed");
}
