import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  hooks: {
    afterAllFileWrite: "biome check --write",
  },
};

export default config;
