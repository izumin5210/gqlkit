import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  sourceDir: "src/gql",
  output: {
    resolversPath: "src/gqlkit/__generated__/resolvers.ts",
    typeDefsPath: "src/gqlkit/__generated__/schema.ts",
    schemaPath: "src/gqlkit/__generated__/schema.graphql",
  },
};

export default config;
