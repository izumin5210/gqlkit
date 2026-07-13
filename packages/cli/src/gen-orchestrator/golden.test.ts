import { access, readdir, readFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GqlkitConfig } from "../config/index.js";
import type { ResolvedScalarMapping } from "../config-loader/index.js";
import {
  DEFAULT_RESOLVERS_PATH,
  DEFAULT_SCHEMA_PATH,
  DEFAULT_TYPEDEFS_PATH,
} from "../config-loader/types.js";
import { isSnapshotUpdateMode } from "../testing/snapshot.js";
import { executeGeneration } from "./orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testdataDir = join(__dirname, "testdata");
const isUpdateMode = isSnapshotUpdateMode();

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

/**
 * Mirrors `validateOutputPath` (config-loader/validator.ts): `undefined`
 * (key absent from config.json) resolves to the default path; an explicit
 * `null` is preserved as "suppressed" rather than falling back to the
 * default (a plain `??` would collapse both to the same case).
 */
function resolveOutputPath(
  configuredPath: string | null | undefined,
  defaultPath: string,
): string | null {
  return configuredPath === undefined ? defaultPath : configuredPath;
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

      const config = await readJsonIfExists<Partial<GqlkitConfig>>(
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

      const output = {
        resolversPath: resolveOutputPath(
          config?.output?.resolversPath,
          DEFAULT_RESOLVERS_PATH,
        ),
        typeDefsPath: resolveOutputPath(
          config?.output?.typeDefsPath,
          DEFAULT_TYPEDEFS_PATH,
        ),
        schemaPath: resolveOutputPath(
          config?.output?.schemaPath,
          DEFAULT_SCHEMA_PATH,
        ),
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

      // diagnostics.json is a test-harness artifact, not a real gqlkit
      // output — it has no config.json-configurable path, unlike the three
      // files below whose location follows `output.*Path`.
      const diagnosticsPath = join(
        caseDir,
        "src/gqlkit/__generated__/diagnostics.json",
      );

      await expect(
        serializeDiagnostics(result.diagnostics),
      ).toMatchFileSnapshot(diagnosticsPath);

      if (result.success) {
        if (output.typeDefsPath !== null) {
          const typeDefsTs = findFile(result.files, "typeDefs.ts");
          expect(typeDefsTs).toBeDefined();
          await expect(typeDefsTs).toMatchFileSnapshot(
            resolve(caseDir, output.typeDefsPath),
          );
        }
        if (output.schemaPath !== null) {
          const schemaGraphql = findFile(result.files, "schema.graphql");
          expect(schemaGraphql).toBeDefined();
          await expect(schemaGraphql).toMatchFileSnapshot(
            resolve(caseDir, output.schemaPath),
          );
        }
        if (output.resolversPath !== null) {
          const resolversTs = findFile(result.files, "resolvers.ts");
          expect(resolversTs).toBeDefined();
          await expect(resolversTs).toMatchFileSnapshot(
            resolve(caseDir, output.resolversPath),
          );
        }
      } else {
        if (output.typeDefsPath !== null) {
          await assertFileNotExists(
            resolve(caseDir, output.typeDefsPath),
            "typeDefs.ts",
          );
        }
        if (output.schemaPath !== null) {
          await assertFileNotExists(
            resolve(caseDir, output.schemaPath),
            "schema.graphql",
          );
        }
        if (output.resolversPath !== null) {
          await assertFileNotExists(
            resolve(caseDir, output.resolversPath),
            "resolvers.ts",
          );
        }
      }
    });
  }
});
