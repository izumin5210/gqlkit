import { describe, expect, it } from "vitest";
import type {
  GqlkitConfig,
  OutputConfig,
  ScalarMappingConfig,
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
          resolversPath: "src/gqlkit/__generated__/resolvers.ts",
          typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
          schemaPath: "src/gqlkit/__generated__/schema.graphql",
        },
      };
      expect(config.output?.resolversPath).toBe(
        "src/gqlkit/__generated__/resolvers.ts",
      );
      expect(config.output?.typeDefsPath).toBe(
        "src/gqlkit/__generated__/typeDefs.ts",
      );
      expect(config.output?.schemaPath).toBe(
        "src/gqlkit/__generated__/schema.graphql",
      );
    });

    it("should allow config with output suppression using null", () => {
      const config: GqlkitConfig = {
        output: {
          resolversPath: null,
          typeDefsPath: "typeDefs.ts",
          schemaPath: "schema.graphql",
        },
      };
      expect(config.output?.resolversPath).toBe(null);
      expect(config.output?.typeDefsPath).toBe("typeDefs.ts");
      expect(config.output?.schemaPath).toBe("schema.graphql");
    });

    it("should allow config with undefined output paths for defaults", () => {
      const config: GqlkitConfig = {
        output: {},
      };
      expect(config.output?.resolversPath).toBe(undefined);
      expect(config.output?.typeDefsPath).toBe(undefined);
      expect(config.output?.schemaPath).toBe(undefined);
    });
  });

  describe("OutputConfig", () => {
    it("should allow all string paths", () => {
      const config: OutputConfig = {
        resolversPath: "custom/path/resolvers.ts",
        typeDefsPath: "custom/path/typeDefs.ts",
        schemaPath: "custom/path/schema.graphql",
      };
      expect(config.resolversPath).toBe("custom/path/resolvers.ts");
      expect(config.typeDefsPath).toBe("custom/path/typeDefs.ts");
      expect(config.schemaPath).toBe("custom/path/schema.graphql");
    });

    it("should allow null for output suppression", () => {
      const config: OutputConfig = {
        resolversPath: null,
        typeDefsPath: null,
        schemaPath: null,
      };
      expect(config.resolversPath).toBe(null);
      expect(config.typeDefsPath).toBe(null);
      expect(config.schemaPath).toBe(null);
    });

    it("should allow omitting properties for default paths", () => {
      const config: OutputConfig = {};
      expect(config.resolversPath).toBe(undefined);
      expect(config.typeDefsPath).toBe(undefined);
      expect(config.schemaPath).toBe(undefined);
    });

    it("should allow mixed configurations", () => {
      const config: OutputConfig = {
        resolversPath: "resolvers.ts",
        typeDefsPath: null,
      };
      expect(config.resolversPath).toBe("resolvers.ts");
      expect(config.typeDefsPath).toBe(null);
      expect(config.schemaPath).toBe(undefined);
    });
  });
});
