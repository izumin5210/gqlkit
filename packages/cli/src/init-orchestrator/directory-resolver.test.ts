import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProjectDirectory } from "./directory-resolver.js";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `gqlkit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

describe("resolveProjectDirectory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("when dir argument is provided", () => {
    it("uses the provided directory as project directory", async () => {
      const projectDir = join(tempDir, "my-project");
      mkdirSync(projectDir, { recursive: true });
      writeFile(join(projectDir, "package.json"), "{}");

      const result = await resolveProjectDirectory({
        cwd: tempDir,
        dir: projectDir,
      });

      expect(result.directories).not.toBeNull();
      expect(result.directories?.projectDir).toBe(projectDir);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("resolves relative path from cwd", async () => {
      const projectDir = join(tempDir, "my-project");
      mkdirSync(projectDir, { recursive: true });
      writeFile(join(projectDir, "package.json"), "{}");

      const result = await resolveProjectDirectory({
        cwd: tempDir,
        dir: "my-project",
      });

      expect(result.directories).not.toBeNull();
      expect(result.directories?.projectDir).toBe(projectDir);
    });
  });

  describe("when dir argument is not provided", () => {
    it("finds project directory by searching upward for package.json", async () => {
      const projectDir = join(tempDir, "project");
      const nestedDir = join(projectDir, "src", "nested");
      mkdirSync(nestedDir, { recursive: true });
      writeFile(join(projectDir, "package.json"), "{}");

      const result = await resolveProjectDirectory({
        cwd: nestedDir,
        dir: null,
      });

      expect(result.directories).not.toBeNull();
      expect(result.directories?.projectDir).toBe(projectDir);
    });

    it("finds project directory by searching upward for gqlkit.config.ts with package.json", async () => {
      const projectDir = join(tempDir, "project");
      const nestedDir = join(projectDir, "src", "nested");
      mkdirSync(nestedDir, { recursive: true });
      writeFile(join(projectDir, "gqlkit.config.ts"), "export default {};");
      writeFile(join(projectDir, "package.json"), "{}");

      const result = await resolveProjectDirectory({
        cwd: nestedDir,
        dir: null,
      });

      expect(result.directories).not.toBeNull();
      expect(result.directories?.projectDir).toBe(projectDir);
    });

    it("returns error when gqlkit.config.ts found but no package.json", async () => {
      const projectDir = join(tempDir, "project");
      const nestedDir = join(projectDir, "src", "nested");
      mkdirSync(nestedDir, { recursive: true });
      writeFile(join(projectDir, "gqlkit.config.ts"), "export default {};");

      const result = await resolveProjectDirectory({
        cwd: nestedDir,
        dir: null,
      });

      expect(result.directories).toBeNull();
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("INIT_PACKAGE_JSON_NOT_FOUND");
    });

    it("prefers package.json at the same level as gqlkit.config.ts", async () => {
      const projectDir = join(tempDir, "project");
      const nestedDir = join(projectDir, "src");
      mkdirSync(nestedDir, { recursive: true });
      writeFile(join(projectDir, "package.json"), "{}");
      writeFile(join(projectDir, "gqlkit.config.ts"), "export default {};");

      const result = await resolveProjectDirectory({
        cwd: nestedDir,
        dir: null,
      });

      expect(result.directories).not.toBeNull();
      expect(result.directories?.projectDir).toBe(projectDir);
    });
  });

  describe("error handling", () => {
    it("returns error when no project directory is found", async () => {
      const isolatedDir = join(tempDir, "isolated");
      mkdirSync(isolatedDir, { recursive: true });

      const result = await resolveProjectDirectory({
        cwd: isolatedDir,
        dir: null,
      });

      expect(result.directories).toBeNull();
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("INIT_PROJECT_NOT_FOUND");
      expect(result.diagnostics[0]!.severity).toBe("error");
    });

    it("returns error when provided directory does not have package.json", async () => {
      const projectDir = join(tempDir, "no-package");
      mkdirSync(projectDir, { recursive: true });

      const result = await resolveProjectDirectory({
        cwd: tempDir,
        dir: projectDir,
      });

      expect(result.directories).toBeNull();
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("INIT_PACKAGE_JSON_NOT_FOUND");
    });
  });

  describe("default directories", () => {
    it("uses default gqlkitDir and schemaDir when no config", async () => {
      const projectDir = join(tempDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFile(join(projectDir, "package.json"), "{}");

      const result = await resolveProjectDirectory({
        cwd: projectDir,
        dir: null,
      });

      expect(result.directories).not.toBeNull();
      expect(result.directories?.gqlkitDir).toBe(
        join(projectDir, "src", "gqlkit"),
      );
      expect(result.directories?.schemaDir).toBe(
        join(projectDir, "src", "gqlkit", "schema"),
      );
    });
  });

  describe("config sourceDir", () => {
    it("uses sourceDir from gqlkit.config.ts when specified", async () => {
      const projectDir = join(tempDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFile(join(projectDir, "package.json"), "{}");
      writeFile(
        join(projectDir, "gqlkit.config.ts"),
        `import { defineConfig } from "@gqlkit-ts/cli";
export default defineConfig({
  sourceDir: "custom/schema",
});`,
      );

      const result = await resolveProjectDirectory({
        cwd: projectDir,
        dir: null,
      });

      expect(result.directories).not.toBeNull();
      expect(result.directories?.gqlkitDir).toBe(join(projectDir, "custom"));
      expect(result.directories?.schemaDir).toBe(
        join(projectDir, "custom", "schema"),
      );
    });
  });
});
