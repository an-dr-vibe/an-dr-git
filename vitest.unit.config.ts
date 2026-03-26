import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "json-summary", "html"],
      include: ["src/shared/domain/project-scaffold.ts"],
    },
  },
});
