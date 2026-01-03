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
      const result = await loadConfig({ cwd: tempDir });

      expect(result.configPath).toBe(undefined);
      expect(result.config).toEqual({
        sourceDir: "src/gqlkit",
        sourceIgnoreGlobs: [],
        output: {
          resolversPath: "src/gqlkit/__generated__/resolvers.ts",
          typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
          schemaPath: "src/gqlkit/__generated__/schema.graphql",
        },
        scalars: [],
        tsconfigPath: null,
      });
      expect(result.diagnostics.length).toBe(0);
    });

    it("should load config from gqlkit.config.ts", async () => {
      const configContent = `
export default {
  scalars: [
    {
      graphqlName: "DateTime",
      type: { from: "./src/scalars", name: "DateTime" },
    },
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir });

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
    { graphqlName: "DateTime", type: { from: "./src/scalars", name: "DateTime" } },
    { graphqlName: "UUID", type: { from: "./src/scalars", name: "UUID" } },
    { graphqlName: "URL", type: { from: "@my-lib/types", name: "URL" } },
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir });

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
    { graphqlName: "DateTime", type: { from: "./src/scalars", name: "DateTime" }
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir });

      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_SYNTAX_ERROR");
      expect(result.diagnostics[0]?.severity).toBe("error");
    });

    it("should load config without defineConfig wrapper", async () => {
      const configContent = `
export default {
  scalars: [
    { graphqlName: "DateTime", type: { from: "./src/scalars", name: "DateTime" } },
  ],
};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir });

      expect(result.config.scalars.length).toBe(1);
      expect(result.config.scalars[0]?.graphqlName).toBe("DateTime");
    });

    it("should handle empty config object", async () => {
      const configContent = `
export default {};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir });

      expect(result.config).toEqual({
        sourceDir: "src/gqlkit",
        sourceIgnoreGlobs: [],
        output: {
          resolversPath: "src/gqlkit/__generated__/resolvers.ts",
          typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
          schemaPath: "src/gqlkit/__generated__/schema.graphql",
        },
        scalars: [],
        tsconfigPath: null,
      });
      expect(result.diagnostics.length).toBe(0);
    });
  });
});
