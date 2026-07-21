import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: ".coverage",
    },
    include: ["test/**/*.test.ts"],
    pool: "forks",
    restoreMocks: true,
  },
});
