import { describe, expect, it } from "vitest";
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
      expect(config.graphqlName).toBe("DateTime");
      expect(config.type.from).toBe("./src/scalars");
      expect(config.type.name).toBe("DateTime");
    });

    it("should support package path imports", () => {
      const config: ScalarMappingConfig = {
        graphqlName: "UUID",
        type: {
          from: "@my-lib/scalars",
          name: "UUID",
        },
      };
      expect(config.type.from).toBe("@my-lib/scalars");
    });
  });

  describe("GqlkitConfig", () => {
    it("should allow empty config", () => {
      const config: GqlkitConfig = {};
      expect(config.scalars).toBe(undefined);
    });

    it("should allow config with empty scalars array", () => {
      const config: GqlkitConfig = {
        scalars: [],
      };
      expect(config.scalars).toEqual([]);
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
      expect(config.scalars?.length).toBe(1);
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
      expect(config.scalars?.length).toBe(3);
    });

    it("should allow config with output settings", () => {
      const config: GqlkitConfig = {
        output: {
          ast: "src/gqlkit/generated/schema.ts",
          sdl: "src/gqlkit/generated/schema.graphql",
        },
      };
      expect(config.output?.ast).toBe("src/gqlkit/generated/schema.ts");
      expect(config.output?.sdl).toBe("src/gqlkit/generated/schema.graphql");
    });

    it("should allow config with output suppression using null", () => {
      const config: GqlkitConfig = {
        output: {
          ast: null,
          sdl: "schema.graphql",
        },
      };
      expect(config.output?.ast).toBe(null);
      expect(config.output?.sdl).toBe("schema.graphql");
    });

    it("should allow config with undefined output paths for defaults", () => {
      const config: GqlkitConfig = {
        output: {},
      };
      expect(config.output?.ast).toBe(undefined);
      expect(config.output?.sdl).toBe(undefined);
    });
  });

  describe("SchemaOutputConfig", () => {
    it("should allow all string paths", () => {
      const config: SchemaOutputConfig = {
        ast: "custom/path/schema.ts",
        sdl: "custom/path/schema.graphql",
      };
      expect(config.ast).toBe("custom/path/schema.ts");
      expect(config.sdl).toBe("custom/path/schema.graphql");
    });

    it("should allow null for output suppression", () => {
      const config: SchemaOutputConfig = {
        ast: null,
        sdl: null,
      };
      expect(config.ast).toBe(null);
      expect(config.sdl).toBe(null);
    });

    it("should allow omitting properties for default paths", () => {
      const config: SchemaOutputConfig = {};
      expect(config.ast).toBe(undefined);
      expect(config.sdl).toBe(undefined);
    });

    it("should allow mixed configurations", () => {
      const config: SchemaOutputConfig = {
        ast: "schema.ts",
        sdl: null,
      };
      expect(config.ast).toBe("schema.ts");
      expect(config.sdl).toBe(null);
    });
  });
});
