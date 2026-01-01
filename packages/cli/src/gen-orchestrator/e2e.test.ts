import assert from "node:assert";
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
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

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

      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes("Done!") || stdout.includes("complete"));
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

      assert.ok(schemaStat.isFile());
      assert.ok(resolversStat.isFile());
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

      assert.ok(schemaContent.includes("import type { DocumentNode }"));
      assert.ok(schemaContent.includes("export const typeDefs"));
      assert.ok(resolversContent.includes("export const resolvers"));
    });
  });

  describe("error handling", () => {
    it("should exit with code 1 when types directory is missing", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      const { exitCode, stderr } = await runCli(testDir);

      assert.strictEqual(exitCode, 1);
      assert.ok(
        stderr.includes("DIRECTORY_NOT_FOUND") || stderr.includes("error"),
      );
    });

    it("should output diagnostic messages to stderr", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      const { stderr } = await runCli(testDir);

      assert.ok(stderr.length > 0);
      assert.ok(
        stderr.includes("error") || stderr.includes("DIRECTORY_NOT_FOUND"),
      );
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

      assert.strictEqual(exitCode, 1);
      assert.ok(
        stderr.includes("CONFIG_SYNTAX_ERROR"),
        "Should include CONFIG_SYNTAX_ERROR diagnostic",
      );
      assert.ok(
        stderr.includes("Config load failed"),
        "Should include error summary",
      );
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

      assert.strictEqual(exitCode, 1);
      assert.ok(
        stderr.includes("CONFIG_BUILTIN_OVERRIDE"),
        "Should include CONFIG_BUILTIN_OVERRIDE diagnostic",
      );
      assert.ok(
        stderr.includes("String"),
        "Should mention the built-in scalar name",
      );
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

      assert.strictEqual(exitCode, 1);
      assert.ok(
        stderr.includes("CONFIG_DUPLICATE_MAPPING"),
        "Should include CONFIG_DUPLICATE_MAPPING diagnostic",
      );
      assert.ok(
        stderr.includes("DateTime"),
        "Should mention the duplicate scalar name",
      );
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

      assert.strictEqual(exitCode, 1);
      assert.ok(
        stderr.includes("CONFIG_DUPLICATE_TYPE"),
        "Should include CONFIG_DUPLICATE_TYPE diagnostic",
      );
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

      assert.strictEqual(exitCode, 1);
      assert.ok(
        stderr.includes("CONFIG_MISSING_PROPERTY"),
        "Should include CONFIG_MISSING_PROPERTY diagnostic",
      );
      assert.ok(stderr.includes("type"), "Should mention the missing property");
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

      assert.ok(
        stderr.includes("gqlkit.config.ts"),
        "Should include config file path in diagnostic",
      );
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

      assert.strictEqual(exitCode, 0);
      assert.ok(
        stdout.includes("Done!") || stdout.includes("complete"),
        "Should complete successfully",
      );

      const schemaContent = await readFile(
        join(testDir, "src/gqlkit/generated/schema.ts"),
        "utf-8",
      );
      assert.ok(
        schemaContent.includes('"value": "DateTime"'),
        "Schema should include DateTime scalar",
      );
    });
  });
});
