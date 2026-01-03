import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ResolvedScalarMapping } from "../config-loader/index.js";
import type { GqlkitConfig } from "../config/index.js";
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
  files: ReadonlyArray<{ filename: string; content: string }>,
  filename: string,
): string | undefined {
  return files.find((f) => f.filename === filename)?.content;
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
      const typesDir = join(caseDir, "types");
      const resolversDir = join(caseDir, "resolvers");

      const config = await readJsonIfExists<Partial<GqlkitConfig>>(
        join(caseDir, "config.json"),
      );

      const customScalars: ResolvedScalarMapping[] | null =
        config?.scalars?.map((s) => ({
          graphqlName: s.graphqlName,
          typeName: s.type.name,
          importPath: s.type.from,
        })) ?? null;

      const result = await executeGeneration({
        cwd: caseDir,
        typesDir,
        resolversDir,
        outputDir: join(caseDir, "output"),
        configDir: null,
        customScalars,
        output: null,
        tsconfigPath: join(caseDir, "tsconfig.json"),
      });

      const expectedDir = join(caseDir, "expected");

      if (result.success) {
        const schemaTs = findFile(result.files, "schema.ts");
        const schemaGraphql = findFile(result.files, "schema.graphql");
        const resolversTs = findFile(result.files, "resolvers.ts");

        expect(schemaTs).toBeDefined();
        expect(schemaGraphql).toBeDefined();
        expect(resolversTs).toBeDefined();

        await expect(schemaTs).toMatchFileSnapshot(
          join(expectedDir, "schema.ts"),
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
