import suite from "./index";

const run = async () => suite({ format: "json", folder: ".benchmark" });

run()
  .then(() => console.log("Benchmarking complete"))
  .catch(console.log);
