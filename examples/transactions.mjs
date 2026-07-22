import { Database, collectionSchema } from "newtondb";

const schema = {
  accounts: collectionSchema({ primaryKey: "id" }),
  audit: collectionSchema({ primaryKey: "id" }),
};
const database = Database.memory(
  {
    accounts: [
      { balance: 100, id: "from" },
      { balance: 20, id: "to" },
    ],
    audit: [],
  },
  { schema },
);

const receipt = await database.transaction((transaction) => {
  transaction.collection("accounts").update("from", { balance: 75 });
  transaction.collection("accounts").update("to", { balance: 45 });
  transaction.collection("audit").insert({ id: "transfer-1", value: 25 });
});
if (
  receipt.affected !== 3 ||
  database.collection("accounts").get("to")?.balance !== 45
) {
  throw new Error("transaction example failed");
}
