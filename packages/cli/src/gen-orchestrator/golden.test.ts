import { access, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findGeneratedFile,
  listGoldenCaseNames,
  loadGoldenCase,
  serializeDiagnostics,
} from "../testing/golden-cases.js";
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

describe("Golden File Tests", async () => {
  const caseNames = await listGoldenCaseNames(testdataDir);

  for (const caseName of caseNames) {
    it(caseName, async () => {
      const goldenCase = await loadGoldenCase({
        testdataDir,
        name: caseName,
      });
      const caseDir = goldenCase.dir;
      const { output } = goldenCase.generationConfig;

      const result = await executeGeneration(goldenCase.generationConfig);

      await expect(
        serializeDiagnostics(result.diagnostics),
      ).toMatchFileSnapshot(goldenCase.diagnosticsPath);

      if (result.success) {
        if (output.typeDefsPath !== null) {
          const typeDefsTs = findGeneratedFile(result.files, "typeDefs.ts");
          expect(typeDefsTs).toBeDefined();
          await expect(typeDefsTs).toMatchFileSnapshot(
            resolve(caseDir, output.typeDefsPath),
          );
        }
        if (output.schemaPath !== null) {
          const schemaGraphql = findGeneratedFile(
            result.files,
            "schema.graphql",
          );
          expect(schemaGraphql).toBeDefined();
          await expect(schemaGraphql).toMatchFileSnapshot(
            resolve(caseDir, output.schemaPath),
          );
        }
        if (output.resolversPath !== null) {
          const resolversTs = findGeneratedFile(result.files, "resolvers.ts");
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
