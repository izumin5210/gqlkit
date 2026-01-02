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
    const typesDir = join(testDir, "src/gql/types");
    const resolversDir = join(testDir, "src/gql/resolvers");

    await mkdir(typesDir, { recursive: true });
    await mkdir(resolversDir, { recursive: true });

    await writeFile(
      join(typesDir, "user.ts"),
      "export interface User { id: string; name: string; }",
      "utf-8",
    );

    await writeFile(
      join(resolversDir, "query.ts"),
      `
        export type QueryResolver = {
          users: () => User[];
        };
        export const queryResolver: QueryResolver = {
          users: () => [],
        };
        interface User { id: string; name: string; }
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
    it("should generate schema.ts file", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
      const schemaPath = join(testDir, "src/gqlkit/generated/schema.ts");
      const content = await readFile(schemaPath, "utf-8");
      expect(content.includes("typeDefs")).toBeTruthy();
    });

    it("should generate resolvers.ts file", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
      const resolversPath = join(testDir, "src/gqlkit/generated/resolvers.ts");
      const content = await readFile(resolversPath, "utf-8");
      expect(content.includes("resolvers")).toBeTruthy();
    });

    it("should return exit code 0 on success", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should return exit code 1 when types directory is missing", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(1);
    });

    it("should return exit code 1 when resolvers directory is missing", async () => {
      const typesDir = join(testDir, "src/gql/types");
      await mkdir(typesDir, { recursive: true });
      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; }",
        "utf-8",
      );

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
              graphqlName: "String",
              type: { from: "./scalars", name: "MyString" },
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

      const typesDir = join(testDir, "src/gql/types");
      await mkdir(typesDir, { recursive: true });
      await writeFile(
        join(typesDir, "event.ts"),
        `
          import type { DateTime } from "../../scalars/index.js";
          export interface Event { id: string; createdAt: DateTime; }
        `,
        "utf-8",
      );

      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });
      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface Event { id: string; createdAt: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const events = defineQuery<NoArgs, Event[]>(function() { return []; });
        `,
        "utf-8",
      );

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                graphqlName: "DateTime",
                type: { from: "./src/scalars", name: "DateTime" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const result = await runGenCommand({ cwd: testDir });

      expect(result.exitCode).toBe(0);
      const schemaPath = join(testDir, "src/gqlkit/generated/schema.ts");
      const content = await readFile(schemaPath, "utf-8");
      expect(
        content.includes('"kind": "ScalarTypeDefinition"') &&
          content.includes('"value": "DateTime"'),
      ).toBeTruthy();
    });
  });
});
