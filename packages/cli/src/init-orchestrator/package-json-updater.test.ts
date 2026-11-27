import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updatePackageJson } from "./package-json-updater.js";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `gqlkit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

describe("updatePackageJson", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("adding dependencies", () => {
    it("adds dependencies that do not exist", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test-package" }, null, 2),
      );

      const result = await updatePackageJson({
        projectDir: tempDir,
        dependencies: [
          { name: "@gqlkit-ts/runtime", version: "latest" },
          { name: "@graphql-tools/schema", version: "latest" },
        ],
      });

      expect(result.updated).toBe(true);
      expect(result.addedDependencies).toContain("@gqlkit-ts/runtime");
      expect(result.addedDependencies).toContain("@graphql-tools/schema");
      expect(result.diagnostics).toHaveLength(0);

      const pkg = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8"),
      );
      expect(pkg.dependencies["@gqlkit-ts/runtime"]).toBe("latest");
      expect(pkg.dependencies["@graphql-tools/schema"]).toBe("latest");
    });

    it("does not modify existing dependencies", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify(
          {
            name: "test-package",
            dependencies: {
              "@gqlkit-ts/runtime": "^1.0.0",
            },
          },
          null,
          2,
        ),
      );

      const result = await updatePackageJson({
        projectDir: tempDir,
        dependencies: [
          { name: "@gqlkit-ts/runtime", version: "latest" },
          { name: "@graphql-tools/schema", version: "latest" },
        ],
      });

      expect(result.updated).toBe(true);
      expect(result.addedDependencies).not.toContain("@gqlkit-ts/runtime");
      expect(result.addedDependencies).toContain("@graphql-tools/schema");

      const pkg = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8"),
      );
      expect(pkg.dependencies["@gqlkit-ts/runtime"]).toBe("^1.0.0");
      expect(pkg.dependencies["@graphql-tools/schema"]).toBe("latest");
    });

    it("returns updated false when no changes needed", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify(
          {
            name: "test-package",
            dependencies: {
              "@gqlkit-ts/runtime": "^1.0.0",
              "@graphql-tools/schema": "^10.0.0",
            },
          },
          null,
          2,
        ),
      );

      const result = await updatePackageJson({
        projectDir: tempDir,
        dependencies: [
          { name: "@gqlkit-ts/runtime", version: "latest" },
          { name: "@graphql-tools/schema", version: "latest" },
        ],
      });

      expect(result.updated).toBe(false);
      expect(result.addedDependencies).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("returns error when package.json does not exist", async () => {
      const result = await updatePackageJson({
        projectDir: tempDir,
        dependencies: [{ name: "@gqlkit-ts/runtime", version: "latest" }],
      });

      expect(result.updated).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("INIT_PACKAGE_JSON_NOT_FOUND");
      expect(result.diagnostics[0]!.severity).toBe("error");
    });

    it("returns error when package.json is invalid JSON", async () => {
      writeFileSync(join(tempDir, "package.json"), "not valid json");

      const result = await updatePackageJson({
        projectDir: tempDir,
        dependencies: [{ name: "@gqlkit-ts/runtime", version: "latest" }],
      });

      expect(result.updated).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("INIT_PACKAGE_JSON_PARSE_ERROR");
      expect(result.diagnostics[0]!.severity).toBe("error");
    });
  });

  describe("JSON formatting", () => {
    it("preserves 2-space indentation", async () => {
      const original = JSON.stringify({ name: "test-package" }, null, 2);
      writeFileSync(join(tempDir, "package.json"), original);

      await updatePackageJson({
        projectDir: tempDir,
        dependencies: [{ name: "@gqlkit-ts/runtime", version: "latest" }],
      });

      const content = readFileSync(join(tempDir, "package.json"), "utf-8");
      expect(content).toContain('  "dependencies"');
    });

    it("adds trailing newline", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      await updatePackageJson({
        projectDir: tempDir,
        dependencies: [{ name: "@gqlkit-ts/runtime", version: "latest" }],
      });

      const content = readFileSync(join(tempDir, "package.json"), "utf-8");
      expect(content.endsWith("\n")).toBe(true);
    });
  });
});
