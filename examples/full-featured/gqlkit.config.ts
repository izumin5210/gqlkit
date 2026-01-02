import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
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
    ast: "src/gqlkit/generated/schema.ts",
    sdl: "src/gqlkit/generated/schema.graphql",
  },
};

export default config;
