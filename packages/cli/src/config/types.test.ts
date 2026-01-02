import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  GqlkitConfig,
  ScalarMappingConfig,
  SchemaOutputConfig,
} from "./types.js";

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

    it("should allow config with output settings", () => {
      const config: GqlkitConfig = {
        output: {
          ast: "src/gqlkit/generated/schema.ts",
          sdl: "src/gqlkit/generated/schema.graphql",
        },
      };
      assert.equal(config.output?.ast, "src/gqlkit/generated/schema.ts");
      assert.equal(config.output?.sdl, "src/gqlkit/generated/schema.graphql");
    });

    it("should allow config with output suppression using null", () => {
      const config: GqlkitConfig = {
        output: {
          ast: null,
          sdl: "schema.graphql",
        },
      };
      assert.equal(config.output?.ast, null);
      assert.equal(config.output?.sdl, "schema.graphql");
    });

    it("should allow config with undefined output paths for defaults", () => {
      const config: GqlkitConfig = {
        output: {},
      };
      assert.equal(config.output?.ast, undefined);
      assert.equal(config.output?.sdl, undefined);
    });
  });

  describe("SchemaOutputConfig", () => {
    it("should allow all string paths", () => {
      const config: SchemaOutputConfig = {
        ast: "custom/path/schema.ts",
        sdl: "custom/path/schema.graphql",
      };
      assert.equal(config.ast, "custom/path/schema.ts");
      assert.equal(config.sdl, "custom/path/schema.graphql");
    });

    it("should allow null for output suppression", () => {
      const config: SchemaOutputConfig = {
        ast: null,
        sdl: null,
      };
      assert.equal(config.ast, null);
      assert.equal(config.sdl, null);
    });

    it("should allow omitting properties for default paths", () => {
      const config: SchemaOutputConfig = {};
      assert.equal(config.ast, undefined);
      assert.equal(config.sdl, undefined);
    });

    it("should allow mixed configurations", () => {
      const config: SchemaOutputConfig = {
        ast: "schema.ts",
        sdl: null,
      };
      assert.equal(config.ast, "schema.ts");
      assert.equal(config.sdl, null);
    });
  });
});
