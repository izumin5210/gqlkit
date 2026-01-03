import { readdir, readFile } from "node:fs/promises";
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
import { executeGeneration } from "./orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testdataDir = join(__dirname, "testdata");

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
  return `${JSON.stringify(diagnostics, null, 2)}\n`;
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

      const config = await readJsonIfExists<Partial<GqlkitConfig>>(
        join(caseDir, "config.json"),
      );

      const customScalars: ResolvedScalarMapping[] | null =
        config?.scalars?.map((s) => ({
          graphqlName: s.graphqlName,
          typeName: s.type.name,
          importPath: s.type.from,
        })) ?? null;

      const sourceDir = config?.sourceDir ?? "src/gqlkit";

      const result = await executeGeneration({
        cwd: caseDir,
        sourceDir,
        sourceIgnoreGlobs: config?.sourceIgnoreGlobs ?? [],
        output: {
          resolversPath: DEFAULT_RESOLVERS_PATH,
          typeDefsPath: DEFAULT_TYPEDEFS_PATH,
          schemaPath: DEFAULT_SCHEMA_PATH,
        },
        configDir: null,
        customScalars,
        tsconfigPath: join(caseDir, "tsconfig.json"),
      });

      const expectedDir = join(caseDir, "expected");

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
        await expect(
          serializeDiagnostics(result.diagnostics),
        ).toMatchFileSnapshot(join(expectedDir, "diagnostics.json"));
      }
    });
  }
});
