import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GqlkitConfig, ScalarMappingConfig } from "./types.js";

describe("Config Types", () => {
  describe("ScalarMappingConfig", () => {
    it("should have correct structure with graphqlName and type", () => {
      const config: ScalarMappingConfig = {
        graphqlName: "DateTime",
        type: {
          from: "./src/scalars",
          name: "DateTime",
        },
      };
      assert.equal(config.graphqlName, "DateTime");
      assert.equal(config.type.from, "./src/scalars");
      assert.equal(config.type.name, "DateTime");
    });

    it("should support package path imports", () => {
      const config: ScalarMappingConfig = {
        graphqlName: "UUID",
        type: {
          from: "@my-lib/scalars",
          name: "UUID",
        },
      };
      assert.equal(config.type.from, "@my-lib/scalars");
    });
  });

  describe("GqlkitConfig", () => {
    it("should allow empty config", () => {
      const config: GqlkitConfig = {};
      assert.equal(config.scalars, undefined);
    });

    it("should allow config with empty scalars array", () => {
      const config: GqlkitConfig = {
        scalars: [],
      };
      assert.deepEqual(config.scalars, []);
    });

    it("should allow config with single scalar mapping", () => {
      const config: GqlkitConfig = {
        scalars: [
          {
            graphqlName: "DateTime",
            type: { from: "./src/scalars", name: "DateTime" },
          },
        ],
      };
      assert.equal(config.scalars?.length, 1);
    });

    it("should allow config with multiple scalar mappings", () => {
      const config: GqlkitConfig = {
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
            type: { from: "@my-lib/url", name: "URL" },
          },
        ],
      };
      assert.equal(config.scalars?.length, 3);
    });
  });
});
