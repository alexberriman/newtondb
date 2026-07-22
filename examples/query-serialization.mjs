import {
  Database,
  collectionSchema,
  parseWhere,
  queryGrammarVersion,
} from "newtondb";

const wire = JSON.stringify({
  conditions: [
    { op: "eq", path: ["active"], value: true },
    { op: "gte", path: ["score"], value: 90 },
  ],
  op: "and",
});
const condition = parseWhere(JSON.parse(wire));
const database = Database.memory(
  {
    records: [
      { active: true, id: 1, score: 98 },
      { active: false, id: 2, score: 100 },
    ],
  },
  { schema: { records: collectionSchema({ primaryKey: "id" }) } },
);
if (
  queryGrammarVersion !== 1 ||
  database.collection("records").findMany(condition)[0]?.id !== 1
) {
  throw new Error("query serialization example failed");
}
