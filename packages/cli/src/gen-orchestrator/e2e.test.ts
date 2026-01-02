import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../..");

function runCli(
  testCwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cliPath = join(projectRoot, "src/cli.ts");
    const child = spawn(
      "node",
      ["--import", "tsx", cliPath, "gen", "--cwd", testCwd],
      { cwd: projectRoot, env: { ...process.env } },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

describe("E2E Tests (Task 7)", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "gqlkit-e2e-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true });
  });

  describe("successful generation", () => {
    it("should exit with code 0 on successful generation", async () => {
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
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const users = defineQuery<NoArgs, User[]>(function() { return []; });
        `,
        "utf-8",
      );

      const { exitCode, stdout } = await runCli(testDir);

      expect(exitCode).toBe(0);
      expect(
        stdout.includes("Done!") || stdout.includes("complete"),
      ).toBeTruthy();
    });

    it("should create output files", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; }",
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1" }; });
        `,
        "utf-8",
      );

      await runCli(testDir);

      const schemaPath = join(outputDir, "schema.ts");
      const resolversPath = join(outputDir, "resolvers.ts");

      const schemaStat = await stat(schemaPath);
      const resolversStat = await stat(resolversPath);

      expect(schemaStat.isFile()).toBeTruthy();
      expect(resolversStat.isFile()).toBeTruthy();
    });

    it("should generate TypeScript code that can be type-checked", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

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
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const users = defineQuery<NoArgs, User[]>(function() { return []; });
        `,
        "utf-8",
      );

      await runCli(testDir);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      const resolversContent = await readFile(
        join(outputDir, "resolvers.ts"),
        "utf-8",
      );

      expect(
        schemaContent.includes("import type { DocumentNode }"),
      ).toBeTruthy();
      expect(schemaContent.includes("export const typeDefs")).toBeTruthy();
      expect(resolversContent.includes("export const resolvers")).toBeTruthy();
    });
  });

  describe("error handling", () => {
    it("should exit with code 1 when types directory is missing", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      const { exitCode, stderr } = await runCli(testDir);

      expect(exitCode).toBe(1);
      expect(
        stderr.includes("DIRECTORY_NOT_FOUND") || stderr.includes("error"),
      ).toBeTruthy();
    });

    it("should output diagnostic messages to stderr", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      const { stderr } = await runCli(testDir);

      expect(stderr.length > 0).toBeTruthy();
      expect(
        stderr.includes("error") || stderr.includes("DIRECTORY_NOT_FOUND"),
      ).toBeTruthy();
    });
  });

  describe("config error diagnostics (Task 8.2)", () => {
    async function setupBasicProject(): Promise<void> {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; }",
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1" }; });
        `,
        "utf-8",
      );
    }

    it("should output CONFIG_SYNTAX_ERROR for invalid config syntax", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
          // syntax error - missing closing bracket
        `,
        "utf-8",
      );

      const { exitCode, stderr } = await runCli(testDir);

      expect(exitCode).toBe(1);
      expect(stderr.includes("CONFIG_SYNTAX_ERROR")).toBeTruthy();
      expect(stderr.includes("Config load failed")).toBeTruthy();
    });

    it("should output CONFIG_BUILTIN_OVERRIDE for overriding built-in scalar", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                graphqlName: "String",
                type: { from: "./scalars", name: "MyString" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const { exitCode, stderr } = await runCli(testDir);

      expect(exitCode).toBe(1);
      expect(stderr.includes("CONFIG_BUILTIN_OVERRIDE")).toBeTruthy();
      expect(stderr.includes("String")).toBeTruthy();
    });

    it("should output CONFIG_DUPLICATE_MAPPING for duplicate graphqlName", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                graphqlName: "DateTime",
                type: { from: "./scalars/a", name: "DateTime" },
              },
              {
                graphqlName: "DateTime",
                type: { from: "./scalars/b", name: "AnotherDateTime" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const { exitCode, stderr } = await runCli(testDir);

      expect(exitCode).toBe(1);
      expect(stderr.includes("CONFIG_DUPLICATE_MAPPING")).toBeTruthy();
      expect(stderr.includes("DateTime")).toBeTruthy();
    });

    it("should output CONFIG_DUPLICATE_TYPE for duplicate type mapping", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                graphqlName: "DateTime",
                type: { from: "./scalars", name: "DateTime" },
              },
              {
                graphqlName: "Timestamp",
                type: { from: "./scalars", name: "DateTime" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const { exitCode, stderr } = await runCli(testDir);

      expect(exitCode).toBe(1);
      expect(stderr.includes("CONFIG_DUPLICATE_TYPE")).toBeTruthy();
    });

    it("should output CONFIG_MISSING_PROPERTY for missing required field", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                graphqlName: "DateTime",
              },
            ],
          };
        `,
        "utf-8",
      );

      const { exitCode, stderr } = await runCli(testDir);

      expect(exitCode).toBe(1);
      expect(stderr.includes("CONFIG_MISSING_PROPERTY")).toBeTruthy();
      expect(stderr.includes("type")).toBeTruthy();
    });

    it("should include file location in diagnostic output", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                graphqlName: "String",
                type: { from: "./scalars", name: "MyString" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const { stderr } = await runCli(testDir);

      expect(stderr.includes("gqlkit.config.ts")).toBeTruthy();
    });

    it("should generate schema successfully with valid custom scalar config", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            scalars: [
              {
                graphqlName: "DateTime",
                type: { from: "./scalars", name: "DateTime" },
              },
            ],
          };
        `,
        "utf-8",
      );

      const { exitCode, stdout } = await runCli(testDir);

      expect(exitCode).toBe(0);
      expect(
        stdout.includes("Done!") || stdout.includes("complete"),
      ).toBeTruthy();

      const schemaContent = await readFile(
        join(testDir, "src/gqlkit/generated/schema.ts"),
        "utf-8",
      );
      expect(schemaContent.includes('"value": "DateTime"')).toBeTruthy();
    });
  });

  describe("tsconfig integration (Task 0019)", () => {
    async function setupBasicProject(): Promise<void> {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; }",
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1" }; });
        `,
        "utf-8",
      );
    }

    it("should use tsconfig.json when present in project root", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            strict: true,
          },
        }),
        "utf-8",
      );

      const { exitCode, stdout } = await runCli(testDir);

      expect(exitCode).toBe(0);
      expect(
        stdout.includes("Done!") || stdout.includes("complete"),
      ).toBeTruthy();
    });

    it("should use custom tsconfig path from config file", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "tsconfig.build.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            strict: true,
          },
        }),
        "utf-8",
      );

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            tsconfigPath: "./tsconfig.build.json",
          };
        `,
        "utf-8",
      );

      const { exitCode, stdout } = await runCli(testDir);

      expect(exitCode).toBe(0);
      expect(
        stdout.includes("Done!") || stdout.includes("complete"),
      ).toBeTruthy();
    });

    it("should exit with code 1 when custom tsconfig path does not exist", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "gqlkit.config.ts"),
        `
          export default {
            tsconfigPath: "./nonexistent-tsconfig.json",
          };
        `,
        "utf-8",
      );

      const { exitCode, stderr } = await runCli(testDir);

      expect(exitCode).toBe(1);
      expect(stderr.includes("TSCONFIG_NOT_FOUND")).toBeTruthy();
    });

    it("should work without tsconfig.json (use default compiler options)", async () => {
      await setupBasicProject();

      const { exitCode, stdout } = await runCli(testDir);

      expect(exitCode).toBe(0);
      expect(
        stdout.includes("Done!") || stdout.includes("complete"),
      ).toBeTruthy();
    });

    it("should generate consistent output with tsconfig.json present", async () => {
      await setupBasicProject();

      await writeFile(
        join(testDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            strict: true,
          },
        }),
        "utf-8",
      );

      const result1 = await runCli(testDir);
      const schema1 = await readFile(
        join(testDir, "src/gqlkit/generated/schema.ts"),
        "utf-8",
      );

      await rm(join(testDir, "src/gqlkit/generated"), {
        recursive: true,
        force: true,
      });

      const result2 = await runCli(testDir);
      const schema2 = await readFile(
        join(testDir, "src/gqlkit/generated/schema.ts"),
        "utf-8",
      );

      expect(result1.exitCode).toBe(0);
      expect(result2.exitCode).toBe(0);
      expect(schema1).toBe(schema2);
    });
  });
});
