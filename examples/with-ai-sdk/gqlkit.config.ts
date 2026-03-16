import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  hooks: {
    afterAllFileWrite: "biome check --write",
  },
  discriminatorFields: {
    // Auto-generated union name from Message.parts field → discriminator is "type"
    MessagePart: ["type", "state"],
    // UIMessageChunk variants are discriminated by "type"
    ChatStreamChunk: ["type"],
  },
};

export default config;
