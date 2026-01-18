import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInitCommand } from "./init.js";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `gqlkit-init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  return realpathSync(tempDir);
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

describe("init command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe("directory resolution", () => {
    it("returns error when no project directory is found", async () => {
      const result = await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      expect(result.exitCode).toBe(1);
    });

    it("uses provided directory", async () => {
      const projectDir = join(tempDir, "my-project");
      mkdirSync(projectDir, { recursive: true });
      writeFile(
        join(projectDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      const result = await runInitCommand({
        cwd: tempDir,
        dir: projectDir,
      });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(projectDir, "src", "gqlkit", "context.ts"))).toBe(
        true,
      );
    });
  });

  describe("file generation", () => {
    it("generates all required files", async () => {
      writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      const result = await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(tempDir, "src", "gqlkit", "context.ts"))).toBe(
        true,
      );
      expect(existsSync(join(tempDir, "src", "gqlkit", "gqlkit.ts"))).toBe(
        true,
      );
      expect(existsSync(join(tempDir, "src", "gqlkit", "schema.ts"))).toBe(
        true,
      );
      expect(
        existsSync(join(tempDir, "src", "gqlkit", "schema", ".gitkeep")),
      ).toBe(true);
    });

    it("skips context.ts and gqlkit.ts when existing setup detected", async () => {
      writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      mkdirSync(join(gqlkitDir, "schema"), { recursive: true });
      writeFile(
        join(gqlkitDir, "existing.ts"),
        `import { createGqlkitApis } from "@gqlkit-ts/runtime";
export const { defineQuery } = createGqlkitApis<{}>();`,
      );

      const result = await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(gqlkitDir, "context.ts"))).toBe(false);
      expect(existsSync(join(gqlkitDir, "gqlkit.ts"))).toBe(false);
      expect(existsSync(join(gqlkitDir, "schema.ts"))).toBe(true);
    });
  });

  describe("dependency management", () => {
    it("adds required dependencies to package.json", async () => {
      writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      const pkg = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8"),
      );
      expect(pkg.dependencies["@gqlkit-ts/runtime"]).toBe("latest");
      expect(pkg.dependencies["@graphql-tools/schema"]).toBe("latest");
    });

    it("does not modify existing dependencies", async () => {
      writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            "@gqlkit-ts/runtime": "^1.0.0",
          },
        }),
      );

      await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      const pkg = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8"),
      );
      expect(pkg.dependencies["@gqlkit-ts/runtime"]).toBe("^1.0.0");
      expect(pkg.dependencies["@graphql-tools/schema"]).toBe("latest");
    });
  });

  describe("generated file content", () => {
    it("generates context.ts with correct content", async () => {
      writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      const content = readFileSync(
        join(tempDir, "src", "gqlkit", "context.ts"),
        "utf-8",
      );
      expect(content).toContain("export type GqlkitContext = {}");
    });

    it("generates gqlkit.ts with correct content", async () => {
      writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      const content = readFileSync(
        join(tempDir, "src", "gqlkit", "gqlkit.ts"),
        "utf-8",
      );
      expect(content).toContain(
        'import { createGqlkitApis } from "@gqlkit-ts/runtime"',
      );
      expect(content).toContain("createGqlkitApis<GqlkitContext>()");
    });

    it("generates schema.ts with correct content", async () => {
      writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      await runInitCommand({
        cwd: tempDir,
        dir: null,
      });

      const content = readFileSync(
        join(tempDir, "src", "gqlkit", "schema.ts"),
        "utf-8",
      );
      expect(content).toContain(
        'import { makeExecutableSchema } from "@graphql-tools/schema"',
      );
      expect(content).toContain(
        'import { createResolvers } from "./__generated__/resolvers.js"',
      );
    });
  });
});
