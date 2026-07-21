import { rm } from "node:fs/promises";
import { URL } from "node:url";

await rm(new URL("../dist", import.meta.url), {
  force: true,
  recursive: true,
});
