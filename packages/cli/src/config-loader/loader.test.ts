import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
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

      assert.equal(result.configPath, undefined);
      assert.deepEqual(result.config, { scalars: [] });
      assert.equal(result.diagnostics.length, 0);
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

      assert.equal(result.configPath, path.join(tempDir, "gqlkit.config.ts"));
      assert.equal(result.config.scalars.length, 1);
      assert.equal(result.config.scalars[0]?.graphqlName, "DateTime");
      assert.equal(result.config.scalars[0]?.typeName, "DateTime");
      assert.equal(result.config.scalars[0]?.importPath, "./src/scalars");
      assert.equal(result.diagnostics.length, 0);
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

      assert.equal(result.config.scalars.length, 3);
      assert.equal(result.config.scalars[0]?.graphqlName, "DateTime");
      assert.equal(result.config.scalars[1]?.graphqlName, "UUID");
      assert.equal(result.config.scalars[2]?.graphqlName, "URL");
      assert.equal(result.config.scalars[2]?.importPath, "@my-lib/types");
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

      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_SYNTAX_ERROR");
      assert.equal(result.diagnostics[0]?.severity, "error");
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

      assert.equal(result.config.scalars.length, 1);
      assert.equal(result.config.scalars[0]?.graphqlName, "DateTime");
    });

    it("should handle empty config object", async () => {
      const configContent = `
export default {};
`;
      fs.writeFileSync(path.join(tempDir, "gqlkit.config.ts"), configContent);

      const result = await loadConfig({ cwd: tempDir });

      assert.deepEqual(result.config, { scalars: [] });
      assert.equal(result.diagnostics.length, 0);
    });
  });
});
