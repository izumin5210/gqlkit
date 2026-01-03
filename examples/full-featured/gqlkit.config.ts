import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  sourceDir: "src/gql",
  scalars: [
    {
      graphqlName: "DateTime",
      type: {
        from: "./src/gql/scalars.js",
        name: "DateTime",
      },
    },
  ],
  output: {
    resolversPath: "src/gqlkit/__generated__/resolvers.ts",
    typeDefsPath: "src/gqlkit/__generated__/schema.ts",
    schemaPath: "src/gqlkit/__generated__/schema.graphql",
  },
};

export default config;
