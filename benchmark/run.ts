import type { SaveOptions } from "benny/lib/internal/common-types";
import { findSuite, getSuite, instantiatingSuite } from "./suites";

const config: SaveOptions = { format: "json", folder: ".benchmark" };

async function run() {
  await instantiatingSuite(config);
  await getSuite(config);
  await findSuite(config);
}

run()
  .then(() => console.log("Benchmarking complete"))
  .catch(console.log);
