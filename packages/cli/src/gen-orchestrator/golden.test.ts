import { access, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildASTSchema, type DocumentNode, parse } from "graphql";
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

/**
 * Cases whose generated schema graphql-js rejects because of bugs not fixed
 * yet. Each stays here only while it still fails to build, so a fix has to
 * remove it.
 */
/** Reads the DocumentNode literal out of a generated typeDefs.ts. */
function parseTypeDefsCode(code: string): DocumentNode {
  const start = code.indexOf("= {") + 2;
  const end = code.lastIndexOf("} as DocumentNode") + 1;
  return JSON.parse(code.slice(start, end)) as DocumentNode;
}

const casesWithKnownInvalidSchema: ReadonlySet<string> = new Set([
  // Object types used as argument or input field types (#411).
  "default-value-complex",
  "gqlfield-def-unwrap-bug",
]);

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
          expect(() => parse(schemaGraphql!)).not.toThrow();
          await expect(schemaGraphql).toMatchFileSnapshot(
            resolve(caseDir, output.schemaPath),
          );
          // Golden snapshots only compare text, so check that the output also
          // forms a schema that graphql-js accepts. A federation subgraph's
          // SDL leaves out the federation directive definitions, which
          // composition knows from the linked specs; typeDefs is the
          // document the subgraph executes.
          const typeDefsTs = findGeneratedFile(result.files, "typeDefs.ts");
          const buildSchema = () =>
            buildASTSchema(
              goldenCase.generationConfig.federation === null
                ? parse(schemaGraphql ?? "")
                : parseTypeDefsCode(typeDefsTs ?? ""),
            );
          if (casesWithKnownInvalidSchema.has(caseName)) {
            expect(
              buildSchema,
              `${caseName} now builds; remove it from casesWithKnownInvalidSchema`,
            ).toThrow();
          } else {
            expect(buildSchema).not.toThrow();
          }
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
