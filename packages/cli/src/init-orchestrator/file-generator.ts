import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface GenerateFilesOptions {
  readonly gqlkitDir: string;
  readonly schemaDir: string;
  readonly skipGqlkitSetup: boolean;
}

export interface GeneratedFile {
  readonly path: string;
  readonly skipped: boolean;
  readonly reason: string | null;
}

export interface GenerateFilesResult {
  readonly files: ReadonlyArray<GeneratedFile>;
}

const CONTEXT_TS_CONTENT = `export type GqlkitContext = {};
`;

const GQLKIT_TS_CONTENT = `import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { GqlkitContext } from "./context.js";

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<GqlkitContext>();
`;

const SCHEMA_TS_CONTENT = `import { makeExecutableSchema } from "@graphql-tools/schema";
import { createResolvers } from "./__generated__/resolvers.js";
import { typeDefs } from "./__generated__/typeDefs.js";

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers: createResolvers(),
});
`;

interface FileToGenerate {
  readonly path: string;
  readonly content: string;
  readonly skipIfExistingSetup: boolean;
}

export async function generateFiles(
  options: GenerateFilesOptions,
): Promise<GenerateFilesResult> {
  const { gqlkitDir, schemaDir, skipGqlkitSetup } = options;

  mkdirSync(gqlkitDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });

  const filesToGenerate: FileToGenerate[] = [
    {
      path: join(gqlkitDir, "context.ts"),
      content: CONTEXT_TS_CONTENT,
      skipIfExistingSetup: true,
    },
    {
      path: join(gqlkitDir, "gqlkit.ts"),
      content: GQLKIT_TS_CONTENT,
      skipIfExistingSetup: true,
    },
    {
      path: join(gqlkitDir, "schema.ts"),
      content: SCHEMA_TS_CONTENT,
      skipIfExistingSetup: false,
    },
    {
      path: join(schemaDir, ".gitkeep"),
      content: "",
      skipIfExistingSetup: false,
    },
  ];

  const results: GeneratedFile[] = [];

  for (const file of filesToGenerate) {
    if (skipGqlkitSetup && file.skipIfExistingSetup) {
      results.push({
        path: file.path,
        skipped: true,
        reason: "Skipped due to existing gqlkit setup",
      });
      continue;
    }

    if (existsSync(file.path)) {
      results.push({
        path: file.path,
        skipped: true,
        reason: "File already exists",
      });
      continue;
    }

    writeFileSync(file.path, file.content, "utf-8");
    results.push({
      path: file.path,
      skipped: false,
      reason: null,
    });
  }

  return { files: results };
}
