import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    const sourceDir = join(testDir, "src/gqlkit");

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

  describe("successful generation", () => {
    it("should generate typeDefs.ts file", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
      const typeDefsPath = join(
        testDir,
        "src/gqlkit/__generated__/typeDefs.ts",
      );
      const content = await readFile(typeDefsPath, "utf-8");
      expect(content.includes("typeDefs")).toBeTruthy();
    });

    it("should generate resolvers.ts file", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
      const resolversPath = join(
        testDir,
        "src/gqlkit/__generated__/resolvers.ts",
      );
      const content = await readFile(resolversPath, "utf-8");
      expect(content.includes("createResolvers")).toBeTruthy();
    });

    it("should return exit code 0 on success", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should return exit code 1 when source directory is missing", async () => {
      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(1);
    });
  });

  describe("config file integration (Task 7)", () => {
    it("should continue with default config when config file is not present", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
    });

    it("should load config file when present", async () => {
      await setupProjectWithConfig(`
        export default {
          scalars: [],
        };
      `);

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
    });

    it("should return exit code 1 when config file has syntax error", async () => {
      await setupProjectWithConfig(`
        export default {
          scalars: [
        // invalid syntax
      `);

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(1);
    });

    it("should return exit code 1 when config file has validation error", async () => {
      await setupProjectWithConfig(`
        export default {
          scalars: [
            {
              name: "String",
              tsType: { name: "MyString", from: "./scalars" },
            },
          ],
        };
      `);

      const result = await runGenCommand({ cwd: testDir });

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

      const sourceDir = join(testDir, "src/gqlkit");
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
                tsType: { name: "DateTime", from: "./src/scalars" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const result = await runGenCommand({ cwd: testDir });

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

  describe("hooks integration", () => {
    it("should execute hooks after file generation", async () => {
      await setupProjectWithConfig(`
        export default {
          hooks: {
            afterAllFileWrite: ["node -e \\"console.log('hook executed')\\""],
          },
        };
      `);

      const result = await runGenCommand({ cwd: testDir });

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

      const result = await runGenCommand({ cwd: testDir });

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

      const result = await runGenCommand({ cwd: testDir });

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

      const result = await runGenCommand({ cwd: testDir });

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

      const result = await runGenCommand({ cwd: testDir });

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

      const result = await runGenCommand({ cwd: testDir });

      // Should fail due to generation failure, not hook failure
      expect(result.exitCode).toBe(1);
    });

    it("should not execute hooks when hooks config is empty", async () => {
      await setupProjectWithConfig(`
        export default {
          hooks: {},
        };
      `);

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
    });
  });
});
