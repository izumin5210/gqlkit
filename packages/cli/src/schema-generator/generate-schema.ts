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
  readonly customScalarNames?: ReadonlyArray<string>;
  readonly enablePruning?: boolean;
}

export interface GenerateSchemaResult {
  readonly typeDefsCode: string;
  readonly sdlContent: string;
  readonly resolversCode: string;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly hasErrors: boolean;
  readonly prunedTypes?: ReadonlyArray<string>;
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
  } = input;

  const integratedResult = integrate(
    typesResult,
    resolversResult,
    customScalarNames,
  );

  let documentNode = buildDocumentNode(integratedResult);
  let prunedTypes: ReadonlyArray<string> | undefined;

  if (enablePruning) {
    const pruneResult = pruneDocumentNode({
      documentNode,
      ...(customScalarNames != null && { customScalarNames }),
    });
    documentNode = pruneResult.documentNode;
    prunedTypes = pruneResult.removedTypes;
  }

  const typeDefsCode = emitTypeDefsCode(integratedResult);
  const sdlContent = emitSdlContent(documentNode);

  const resolverInfo = collectResolverInfo(integratedResult);
  const resolversCode = emitResolversCode(resolverInfo, outputDir);

  return {
    typeDefsCode,
    sdlContent,
    resolversCode,
    diagnostics: integratedResult.diagnostics,
    hasErrors: integratedResult.hasErrors,
    ...(prunedTypes != null && { prunedTypes }),
  };
}
