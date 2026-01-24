import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const graphqlPath = resolve(__dirname, "../../node_modules/graphql/index.mjs");

export default defineConfig({
  resolve: {
    alias: {
      graphql: graphqlPath,
    },
    dedupe: ["graphql"],
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        inline: [
          "graphql",
          "@graphql-tools/utils",
          "@graphql-tools/schema",
          "graphql-yoga",
          "graphql-scalars",
          "@envelop/core",
        ],
      },
    },
  },
});
