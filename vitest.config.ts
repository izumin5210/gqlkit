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
          globalSetup: [
            resolve(__dirname, "packages/cli/vitest.global-setup.ts"),
          ],
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
      {
        test: {
          name: "docs",
          root: "./packages/docs",
          include: ["src/**/*.test.ts"],
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
          name: "examples/with-drizzle",
          root: "./examples/with-drizzle",
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
      },
      {
        resolve: {
          alias: {
            graphql: graphqlPath,
          },
          dedupe: ["graphql"],
        },
        test: {
          name: "examples/with-prisma",
          root: "./examples/with-prisma",
          include: ["src/**/*.test.ts"],
          setupFiles: [
            resolve(__dirname, "examples/with-prisma/vitest.setup.ts"),
          ],
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
      },
      {
        resolve: {
          alias: {
            graphql: graphqlPath,
          },
          dedupe: ["graphql"],
        },
        test: {
          name: "examples/full-featured",
          root: "./examples/full-featured",
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
      },
      {
        resolve: {
          alias: {
            graphql: graphqlPath,
          },
          dedupe: ["graphql"],
        },
        test: {
          name: "examples/with-ai-sdk",
          root: "./examples/with-ai-sdk",
          include: ["src/**/*.test.ts"],
          server: {
            deps: {
              inline: [
                "graphql",
                "@graphql-tools/utils",
                "@graphql-tools/schema",
                "@envelop/core",
              ],
            },
          },
        },
      },
    ],
  },
});
