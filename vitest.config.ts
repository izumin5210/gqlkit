import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const graphqlPath = resolve(__dirname, "node_modules/graphql/index.mjs");

export default defineConfig({
  resolve: {
    alias: {
      graphql: graphqlPath,
    },
    dedupe: ["graphql"],
  },
  test: {
    globals: false,
    server: {
      deps: {
        inline: ["graphql", "@graphql-tools/utils"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/*.test.ts", "**/testdata", "examples", "**/dist"],
    },
    projects: [
      {
        resolve: {
          alias: {
            graphql: graphqlPath,
          },
          dedupe: ["graphql"],
        },
        test: {
          name: "cli",
          root: "./packages/cli",
          include: ["src/**/*.test.ts"],
          testTimeout: 30000,
          server: {
            deps: {
              inline: ["graphql", "@graphql-tools/utils"],
            },
          },
        },
      },
      {
        resolve: {
          alias: {
            graphql: graphqlPath,
          },
          dedupe: ["graphql"],
        },
        test: {
          name: "runtime",
          root: "./packages/runtime",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
