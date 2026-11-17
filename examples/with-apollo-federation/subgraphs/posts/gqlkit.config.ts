import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  federation: {
    spec: "apollo-federation",
    url: "https://specs.apollo.dev/federation/v2.9",
    composeDirectives: [
      { url: "https://example.com/redact/v1.0", import: ["@redact"] },
    ],
  },
  hooks: {
    afterAllFileWrite: ["oxlint --fix", "oxfmt"],
  },
});
