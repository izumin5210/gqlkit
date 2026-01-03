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
      include: [
        "packages/cli/src/gen-orchestrator/**/*.ts",
        "packages/cli/src/type-extractor/**/*.ts",
        "packages/cli/src/resolver-extractor/**/*.ts",
        "packages/cli/src/schema-generator/**/*.ts",
        "packages/cli/src/shared/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/testdata/**",
        "**/index.ts",
        "**/parent-type-resolver.ts",
        "**/argument-validator.ts",
      ],
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
