import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  scalars: [
    {
      graphqlName: "DateTime",
      type: {
        from: "./src/gqlkit/scalars.js",
        name: "DateTime",
      },
    },
  ],
};

export default config;
