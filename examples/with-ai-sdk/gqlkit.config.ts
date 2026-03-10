import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  discriminatorFields: {
    // Auto-generated union name from Message.parts field → discriminator is "type"
    MessageParts: ["type", "state"],
  },
};

export default config;
