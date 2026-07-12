import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./loader.js";

describe("ConfigLoader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-loader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe("loadConfig", () => {
    it("should return default config when gqlkit.config.ts does not exist", async () => {
      const result = await loadConfig({ cwd: tempDir, configPath: null });

      expect(result.configPath).toBe(undefined);
      expect(result.config).toEqual({
        sourceDir: "src/gqlkit/schema",
        sourceIgnoreGlobs: [],
        output: {
          resolversPath: "src/gqlkit/__generated__/resolvers.ts",
          typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
          schemaPath: "src/gqlkit/__generated__/schema.graphql",
          importExtension: "js",
          pruning: true,
        },
        scalars: [],
        tsconfigPath: null,
        hooks: {
          afterAllFileWrite: [],
        },
        discriminatorFields: new Map(),
      });
      expect(result.diagnostics.length).toBe(0);
    });

    it("should load config from gqlkit.config.ts", async () => {
      const configContent = `
export default {
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/scalars", name: "DateTime" },
    },
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir, configPath: null });

      expect(result.configPath).toBe(path.join(tempDir, "gqlkit.config.ts"));
      expect(result.config.scalars.length).toBe(1);
      expect(result.config.scalars[0]?.graphqlName).toBe("DateTime");
      expect(result.config.scalars[0]?.typeName).toBe("DateTime");
      expect(result.config.scalars[0]?.importPath).toBe("./src/scalars");
      expect(result.diagnostics.length).toBe(0);
    });

    it("should load config with multiple scalar mappings", async () => {
      const configContent = `
export default {
  scalars: [
    { name: "DateTime", tsType: { from: "./src/scalars", name: "DateTime" } },
    { name: "UUID", tsType: { from: "./src/scalars", name: "UUID" } },
    { name: "URL", tsType: { from: "@my-lib/types", name: "URL" } },
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir, configPath: null });

      expect(result.config.scalars.length).toBe(3);
      expect(result.config.scalars[0]?.graphqlName).toBe("DateTime");
      expect(result.config.scalars[1]?.graphqlName).toBe("UUID");
      expect(result.config.scalars[2]?.graphqlName).toBe("URL");
      expect(result.config.scalars[2]?.importPath).toBe("@my-lib/types");
    });

    it("should return error diagnostic for syntax error", async () => {
      const configContent = `
export default {
  scalars: [
    { name: "DateTime", tsType: { from: "./src/scalars", name: "DateTime" }
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir, configPath: null });

      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_SYNTAX_ERROR");
      expect(result.diagnostics[0]?.severity).toBe("error");
    });

    it("should load config without defineConfig wrapper", async () => {
      const configContent = `
export default {
  scalars: [
    { name: "DateTime", tsType: { from: "./src/scalars", name: "DateTime" } },
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir, configPath: null });

      expect(result.config.scalars.length).toBe(1);
      expect(result.config.scalars[0]?.graphqlName).toBe("DateTime");
    });

    it("should handle empty config object", async () => {
      const configContent = `
export default {};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir, configPath: null });

      expect(result.config).toEqual({
        sourceDir: "src/gqlkit/schema",
        sourceIgnoreGlobs: [],
        output: {
          resolversPath: "src/gqlkit/__generated__/resolvers.ts",
          typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
          schemaPath: "src/gqlkit/__generated__/schema.graphql",
          importExtension: "js",
          pruning: true,
        },
        scalars: [],
        tsconfigPath: null,
        hooks: {
          afterAllFileWrite: [],
        },
        discriminatorFields: new Map(),
      });
      expect(result.diagnostics.length).toBe(0);
    });
  });

  describe("loadConfig with configPath", () => {
    it("should load config from specified relative path", async () => {
      const configContent = `
export default {
  sourceDir: "custom/schema",
};
`;
      fs.mkdirSync(path.join(tempDir, "configs"));
      fs.writeFileSync(
        path.join(tempDir, "configs", "custom.config.ts"),
        configContent,
      );

      const result = await loadConfig({
        cwd: tempDir,
        configPath: "configs/custom.config.ts",
      });

      expect(result.configPath).toBe(
        path.join(tempDir, "configs", "custom.config.ts"),
      );
      expect(result.config.sourceDir).toBe("custom/schema");
      expect(result.diagnostics.length).toBe(0);
    });

    it("should load config from specified absolute path", async () => {
      const configContent = `
export default {
  sourceDir: "absolute/schema",
};
`;
      const absolutePath = path.join(tempDir, "absolute.config.ts");
      fs.writeFileSync(absolutePath, configContent);

      const result = await loadConfig({
        cwd: tempDir,
        configPath: absolutePath,
      });

      expect(result.configPath).toBe(absolutePath);
      expect(result.config.sourceDir).toBe("absolute/schema");
      expect(result.diagnostics.length).toBe(0);
    });

    it("should return error diagnostic when specified config file does not exist", async () => {
      const result = await loadConfig({
        cwd: tempDir,
        configPath: "nonexistent.config.ts",
      });

      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_FILE_NOT_FOUND");
      expect(result.diagnostics[0]?.severity).toBe("error");
      expect(result.diagnostics[0]?.message).toContain("nonexistent.config.ts");
    });

    it("should fall back to auto-discovery when configPath is null", async () => {
      const configContent = `
export default {
  sourceDir: "auto/schema",
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir, configPath: null });

      expect(result.configPath).toBe(path.join(tempDir, "gqlkit.config.ts"));
      expect(result.config.sourceDir).toBe("auto/schema");
      expect(result.diagnostics.length).toBe(0);
    });
  });
});
