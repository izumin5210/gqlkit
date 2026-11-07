import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  hooks: {
    afterAllFileWrite: ["oxlint --fix", "oxfmt"],
  },
};

export default config;
