import { describe, expect, it } from "vitest";
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

    expect(result).toEqual(input);
    expect(result).toBe(input);
  });

  it("should accept empty config", () => {
    const input: GqlkitConfig = {};
    const result = defineConfig(input);
    expect(result).toEqual({});
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

    expect(result.scalars?.length).toBe(3);
    expect(result.scalars?.[0]?.graphqlName).toBe("DateTime");
    expect(result.scalars?.[1]?.graphqlName).toBe("UUID");
    expect(result.scalars?.[2]?.graphqlName).toBe("URL");
  });
});
