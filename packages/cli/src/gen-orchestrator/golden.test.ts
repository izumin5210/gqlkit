import { access, readdir, readFile, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GqlkitConfig } from "../config/index.js";
import type { ResolvedScalarMapping } from "../config-loader/index.js";
import {
  DEFAULT_RESOLVERS_PATH,
  DEFAULT_SCHEMA_PATH,
  DEFAULT_TYPEDEFS_PATH,
} from "../config-loader/loader.js";
import { isSnapshotUpdateMode } from "../testing/snapshot.js";
import { executeGeneration } from "./orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testdataDir = join(__dirname, "testdata");
const isUpdateMode = isSnapshotUpdateMode();

/**
 * Case-level config.json shape. `output.pruning` is declared here ahead of
 * the public `OutputConfig` gaining the key, so pruning-sensitive cases can
 * pin `"output": {"pruning": false}` before the default flips to enabled.
 */
interface GoldenCaseConfig extends Partial<GqlkitConfig> {
  readonly output?: GqlkitConfig["output"] & { readonly pruning?: boolean };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function assertFileNotExists(
  path: string,
  description: string,
): Promise<void> {
  if (await fileExists(path)) {
    if (isUpdateMode) {
      await unlink(path);
    } else {
      throw new Error(
        `${description} should not exist but found at: ${path}. Run with -u flag to remove it.`,
      );
    }
  }
}

async function readJsonIfExists<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function serializeDiagnostics(
  diagnostics: ReadonlyArray<{
    code: string;
    message: string;
    severity: string;
    location: { file: string; line: number; column: number } | null;
  }>,
): string {
  const normalized = diagnostics.map((d) => ({
    ...d,
    location: d.location
      ? { ...d.location, file: d.location.file.replaceAll("\\", "/") }
      : null,
  }));
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

function findFile(
  files: ReadonlyArray<{ filePath: string; content: string }>,
  filename: string,
): string | undefined {
  return files.find((f) => basename(f.filePath) === filename)?.content;
}

describe("Golden File Tests", async () => {
  const entries = await readdir(testdataDir, { withFileTypes: true });
  const caseNames = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();

  for (const caseName of caseNames) {
    it(caseName, async () => {
      const caseDir = join(testdataDir, caseName);

      const config = await readJsonIfExists<GoldenCaseConfig>(
        join(caseDir, "config.json"),
      );

      const customScalars: ResolvedScalarMapping[] | null =
        config?.scalars?.map((s) => ({
          graphqlName: s.name,
          typeName: s.tsType.name,
          importPath: s.tsType.from ?? null,
          only: s.only ?? null,
          description: s.description ?? null,
        })) ?? null;

      const sourceDir = config?.sourceDir ?? "src/gqlkit/schema";

      const discriminatorFields = new Map<string, ReadonlyArray<string>>();
      if (config?.discriminatorFields) {
        for (const [key, value] of Object.entries(config.discriminatorFields)) {
          discriminatorFields.set(
            key,
            typeof value === "string" ? [value] : value,
          );
        }
      }

      // Output paths stay hardcoded to the defaults for now; only
      // `output.pruning` (and `output.importExtension`) are threaded from
      // config.json. Full output-config generalization is a later phase.
      const output = {
        resolversPath: DEFAULT_RESOLVERS_PATH,
        typeDefsPath: DEFAULT_TYPEDEFS_PATH,
        schemaPath: DEFAULT_SCHEMA_PATH,
        importExtension: config?.output?.importExtension ?? "js",
        pruning: config?.output?.pruning ?? true,
      };

      const result = await executeGeneration({
        cwd: caseDir,
        sourceDir,
        sourceIgnoreGlobs: config?.sourceIgnoreGlobs ?? [],
        output,
        configDir: null,
        customScalars,
        tsconfigPath: join(caseDir, "tsconfig.json"),
        discriminatorFields,
      });

      const expectedDir = join(caseDir, "src/gqlkit/__generated__");

      await expect(
        serializeDiagnostics(result.diagnostics),
      ).toMatchFileSnapshot(join(expectedDir, "diagnostics.json"));

      if (result.success) {
        const typeDefsTs = findFile(result.files, "typeDefs.ts");
        const schemaGraphql = findFile(result.files, "schema.graphql");
        const resolversTs = findFile(result.files, "resolvers.ts");

        expect(typeDefsTs).toBeDefined();
        expect(schemaGraphql).toBeDefined();
        expect(resolversTs).toBeDefined();

        await expect(typeDefsTs).toMatchFileSnapshot(
          join(expectedDir, "typeDefs.ts"),
        );
        await expect(schemaGraphql).toMatchFileSnapshot(
          join(expectedDir, "schema.graphql"),
        );
        await expect(resolversTs).toMatchFileSnapshot(
          join(expectedDir, "resolvers.ts"),
        );
      } else {
        await assertFileNotExists(
          join(expectedDir, "typeDefs.ts"),
          "typeDefs.ts",
        );
        await assertFileNotExists(
          join(expectedDir, "schema.graphql"),
          "schema.graphql",
        );
        await assertFileNotExists(
          join(expectedDir, "resolvers.ts"),
          "resolvers.ts",
        );
      }
    });
  }
});
