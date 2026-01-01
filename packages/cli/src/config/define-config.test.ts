import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineConfig } from "./define-config.js";
import type { GqlkitConfig } from "./types.js";

describe("defineConfig", () => {
  it("should return the same config object", () => {
    const input: GqlkitConfig = {
      scalars: [
        {
          graphqlName: "DateTime",
          type: { from: "./src/scalars", name: "DateTime" },
        },
      ],
    };

    const result = defineConfig(input);

    assert.deepEqual(result, input);
    assert.strictEqual(result, input);
  });

  it("should accept empty config", () => {
    const input: GqlkitConfig = {};
    const result = defineConfig(input);
    assert.deepEqual(result, {});
  });

  it("should accept config with multiple scalars", () => {
    const input: GqlkitConfig = {
      scalars: [
        {
          graphqlName: "DateTime",
          type: { from: "./src/scalars", name: "DateTime" },
        },
        {
          graphqlName: "UUID",
          type: { from: "./src/scalars", name: "UUID" },
        },
        {
          graphqlName: "URL",
          type: { from: "@company/types", name: "URL" },
        },
      ],
    };

    const result = defineConfig(input);

    assert.equal(result.scalars?.length, 3);
    assert.equal(result.scalars?.[0]?.graphqlName, "DateTime");
    assert.equal(result.scalars?.[1]?.graphqlName, "UUID");
    assert.equal(result.scalars?.[2]?.graphqlName, "URL");
  });
});
