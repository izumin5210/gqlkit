import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import type { ExtractTypesResult } from "../type-extractor/index.js";
import type { Diagnostic } from "../type-extractor/types/index.js";
import { buildDocumentNode } from "./builder/ast-builder.js";
import { emitResolversCode, emitTypeDefsCode } from "./emitter/code-emitter.js";
import { emitSdlContent } from "./emitter/sdl-emitter.js";
import { integrate } from "./integrator/result-integrator.js";
import { pruneDocumentNode } from "./pruner/schema-pruner.js";
import { collectResolverInfo } from "./resolver-collector/resolver-collector.js";

export interface GenerateSchemaInput {
  readonly typesResult: ExtractTypesResult;
  readonly resolversResult: ExtractResolversResult;
  readonly outputDir: string;
  readonly customScalarNames: ReadonlyArray<string> | null;
  readonly enablePruning: boolean | null;
  readonly sourceRoot: string | null;
}

export interface GenerateSchemaResult {
  readonly typeDefsCode: string;
  readonly sdlContent: string;
  readonly resolversCode: string;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly hasErrors: boolean;
  readonly prunedTypes: ReadonlyArray<string> | null;
}

export function generateSchema(
  input: GenerateSchemaInput,
): GenerateSchemaResult {
  const {
    typesResult,
    resolversResult,
    outputDir,
    customScalarNames,
    enablePruning,
    sourceRoot,
  } = input;

  const integratedResult = integrate(
    typesResult,
    resolversResult,
    customScalarNames,
  );

  let documentNode = buildDocumentNode(integratedResult, {
    sourceRoot: sourceRoot ?? undefined,
  });
  let prunedTypes: ReadonlyArray<string> | null = null;

  if (enablePruning) {
    const pruneResult = pruneDocumentNode({
      documentNode,
      customScalarNames,
    });
    documentNode = pruneResult.documentNode;
    prunedTypes = pruneResult.removedTypes;
  }

  const typeDefsCode = emitTypeDefsCode(integratedResult, {
    sourceRoot: sourceRoot ?? undefined,
  });
  const sdlContent = emitSdlContent(documentNode);

  const resolverInfo = collectResolverInfo(integratedResult);
  const resolversCode = emitResolversCode(resolverInfo, outputDir);

  return {
    typeDefsCode,
    sdlContent,
    resolversCode,
    diagnostics: integratedResult.diagnostics,
    hasErrors: integratedResult.hasErrors,
    prunedTypes,
  };
}
