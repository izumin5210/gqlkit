import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runGenCommand } from "./gen.js";

describe("gen command", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "gqlkit-gen-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true });
  });

  async function setupProject(): Promise<void> {
    const sourceDir = join(testDir, "src/gqlkit/schema");

    await mkdir(sourceDir, { recursive: true });

    await writeFile(
      join(sourceDir, "types.ts"),
      "export interface User { id: string; name: string; }",
      "utf-8",
    );

    await writeFile(
      join(sourceDir, "resolvers.ts"),
      `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        import type { User } from "./types.js";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const users = defineQuery<NoArgs, User[]>(() => []);
      `,
      "utf-8",
    );
  }

  async function setupProjectWithConfig(
    configContent: string,
    additionalSetup?: () => Promise<void>,
  ): Promise<void> {
    await setupProject();
    await writeFile(join(testDir, "gqlkit.config.ts"), configContent, "utf-8");
    if (additionalSetup) {
      await additionalSetup();
    }
  }

  describe("error handling", () => {
    it("should return exit code 1 when source directory is missing", async () => {
      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(1);
    });

    it("should surface the underlying error when writing output files fails", async () => {
      await setupProject();

      // Pre-create a directory at the default typeDefs output path so the
      // write fails deterministically with a real fs error (EISDIR),
      // instead of relying on permission bits (which root can bypass).
      await mkdir(join(testDir, "src/gqlkit/__generated__/typeDefs.ts"), {
        recursive: true,
      });

      const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Suppress noisy test output.
      });

      try {
        const result = await runGenCommand({ cwd: testDir, configPath: null });

        expect(result.exitCode).toBe(1);
        const messages = stderrSpy.mock.calls.map((call) => call[0]).join("\n");
        expect(messages).toContain("Failed to write output files");
        expect(messages).toMatch(/EISDIR/);
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe("config file integration (Task 7)", () => {
    it("should load config file when present", async () => {
      await setupProjectWithConfig(`
        export default {
          scalars: [],
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(0);
    });

    it("should return exit code 1 when config file has syntax error", async () => {
      await setupProjectWithConfig(`
        export default {
          scalars: [
        // invalid syntax
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(1);
    });

    it("should return exit code 1 when config file has validation error", async () => {
      await setupProjectWithConfig(`
        export default {
          scalars: [
            {
              name: "String",
              tsType: { from: "./scalars", name: "MyString" },
            },
          ],
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(1);
    });

    it("should generate schema with custom scalar definitions", async () => {
      const scalarsDir = join(testDir, "src/scalars");
      await mkdir(scalarsDir, { recursive: true });
      await writeFile(
        join(scalarsDir, "index.ts"),
        `export type DateTime = string & { readonly __brand: unique symbol };`,
        "utf-8",
      );

      const sourceDir = join(testDir, "src/gqlkit/schema");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "event.ts"),
        `
          import type { DateTime } from "../scalars/index.js";
          export interface Event { id: string; createdAt: DateTime; }
        `,
        "utf-8",
      );

      await writeFile(
        join(sourceDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          import type { Event } from "./event.js";
          type Context = unknown;
          const { defineQuery } = createGqlkitApis<Context>();
          export const events = defineQuery<NoArgs, Event[]>(() => []);
        `,
        "utf-8",
      );

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                name: "DateTime",
                tsType: { from: "./src/scalars", name: "DateTime" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(0);
      const typeDefsPath = join(
        testDir,
        "src/gqlkit/__generated__/typeDefs.ts",
      );
      const content = await readFile(typeDefsPath, "utf-8");
      expect(
        content.includes('"kind": "ScalarTypeDefinition"') &&
          content.includes('"value": "DateTime"'),
      ).toBeTruthy();
    });
  });

  describe("--config option", () => {
    it("should load config from specified path", async () => {
      await setupProject();

      const configDir = join(testDir, "configs");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "custom.config.ts"),
        `export default { scalars: [] };`,
        "utf-8",
      );

      const result = await runGenCommand({
        cwd: testDir,
        configPath: "configs/custom.config.ts",
      });

      expect(result.exitCode).toBe(0);
    });

    it("should return exit code 1 when specified config file does not exist", async () => {
      await setupProject();

      const result = await runGenCommand({
        cwd: testDir,
        configPath: "nonexistent.config.ts",
      });

      expect(result.exitCode).toBe(1);
    });

    it("should use config settings from specified file", async () => {
      const customSourceDir = join(testDir, "custom/schema");
      await mkdir(customSourceDir, { recursive: true });

      await writeFile(
        join(customSourceDir, "types.ts"),
        "export interface CustomType { id: string; }",
        "utf-8",
      );

      await writeFile(
        join(customSourceDir, "resolvers.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          import type { CustomType } from "./types.js";
          type Context = unknown;
          const { defineQuery } = createGqlkitApis<Context>();
          export const custom = defineQuery<NoArgs, CustomType[]>(() => []);
        `,
        "utf-8",
      );

      await writeFile(
        join(testDir, "custom.config.ts"),
        `
          export default {
            sourceDir: "custom/schema",
            output: {
              resolversPath: "custom/__generated__/resolvers.ts",
              typeDefsPath: "custom/__generated__/typeDefs.ts",
              schemaPath: "custom/__generated__/schema.graphql",
            },
          };
        `,
        "utf-8",
      );

      const result = await runGenCommand({
        cwd: testDir,
        configPath: "custom.config.ts",
      });

      expect(result.exitCode).toBe(0);

      const typeDefsPath = join(testDir, "custom/__generated__/typeDefs.ts");
      const content = await readFile(typeDefsPath, "utf-8");
      expect(content).toContain("CustomType");
    });
  });

  describe("hooks integration", () => {
    it("should execute hooks after file generation", async () => {
      await setupProjectWithConfig(`
        export default {
          hooks: {
            afterAllFileWrite: ["node -e \\"console.log('hook executed')\\""],
          },
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(0);
    });

    it("should execute multiple hooks sequentially", async () => {
      await setupProjectWithConfig(`
        export default {
          hooks: {
            afterAllFileWrite: [
              "node -e \\"console.log('first')\\"",
              "node -e \\"console.log('second')\\"",
            ],
          },
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(0);
    });

    it("should continue executing hooks when one fails", async () => {
      await setupProjectWithConfig(`
        export default {
          hooks: {
            afterAllFileWrite: [
              "node -e \\"process.exit(1)\\"",
              "node -e \\"console.log('after-failure')\\"",
            ],
          },
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(1);
    });

    it("should return exit code 1 when any hook fails", async () => {
      await setupProjectWithConfig(`
        export default {
          hooks: {
            afterAllFileWrite: ["node -e \\"process.exit(1)\\""],
          },
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(1);
    });

    it("should skip hooks when no files are written", async () => {
      await setupProjectWithConfig(`
        export default {
          output: {
            resolversPath: null,
            typeDefsPath: null,
            schemaPath: null,
          },
          hooks: {
            afterAllFileWrite: ["node -e \\"process.exit(1)\\""],
          },
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      // Should succeed because hooks are skipped when no files are written
      expect(result.exitCode).toBe(0);
    });

    it("should skip hooks when generation fails", async () => {
      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            hooks: {
              afterAllFileWrite: ["node -e \\"process.exit(1)\\""],
            },
          };
        `,
        "utf-8",
      );

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      // Should fail due to generation failure, not hook failure
      expect(result.exitCode).toBe(1);
    });

    it("should not execute hooks when hooks config is empty", async () => {
      await setupProjectWithConfig(`
        export default {
          hooks: {},
        };
      `);

      const result = await runGenCommand({ cwd: testDir, configPath: null });

      expect(result.exitCode).toBe(0);
    });
  });
});
