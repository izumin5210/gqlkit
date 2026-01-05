import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import type { CollectedScalarType } from "../shared/scalar-collector.js";
import type { ExtractTypesResult } from "../type-extractor/index.js";
import type { Diagnostic } from "../type-extractor/types/index.js";
import { buildDocumentNode } from "./builder/ast-builder.js";
import { emitResolversCode, emitTypeDefsCode } from "./emitter/code-emitter.js";
import { emitSdlContent } from "./emitter/sdl-emitter.js";
import { integrate } from "./integrator/result-integrator.js";
import { pruneDocumentNode } from "./pruner/schema-pruner.js";
import {
  type CustomScalarInfo,
  collectResolverInfo,
} from "./resolver-collector/resolver-collector.js";

export interface GenerateSchemaInput {
  readonly typesResult: ExtractTypesResult;
  readonly resolversResult: ExtractResolversResult;
  readonly outputDir: string;
  readonly customScalarNames: ReadonlyArray<string> | null;
  readonly collectedScalars: ReadonlyArray<CollectedScalarType> | null;
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

function buildCustomScalarInfos(
  collectedScalars: ReadonlyArray<CollectedScalarType>,
): CustomScalarInfo[] {
  return collectedScalars.map((scalar) => {
    const inputTypeName = scalar.inputType?.typeName ?? scalar.scalarName;
    const outputTypeNames = scalar.outputTypes.map((t) => t.typeName);
    const outputTypeName =
      outputTypeNames.length > 0 ? outputTypeNames.join(" | ") : inputTypeName;

    const typeImportPath = scalar.inputType?.sourceFile ?? null;

    return {
      scalarName: scalar.scalarName,
      inputTypeName,
      outputTypeName,
      typeImportPath,
    };
  });
}

export function generateSchema(
  input: GenerateSchemaInput,
): GenerateSchemaResult {
  const {
    typesResult,
    resolversResult,
    outputDir,
    customScalarNames,
    collectedScalars,
    enablePruning,
    sourceRoot,
  } = input;

  const integratedResult = integrate(
    typesResult,
    resolversResult,
    customScalarNames,
  );

  let documentNode = buildDocumentNode(
    integratedResult,
    sourceRoot !== null ? { sourceRoot } : undefined,
  );
  let prunedTypes: ReadonlyArray<string> | null = null;

  if (enablePruning) {
    const pruneResult = pruneDocumentNode({
      documentNode,
      customScalarNames,
    });
    documentNode = pruneResult.documentNode;
    prunedTypes = pruneResult.removedTypes;
  }

  const typeDefsCode = emitTypeDefsCode(
    integratedResult,
    sourceRoot !== null ? { sourceRoot } : undefined,
  );
  const sdlContent = emitSdlContent(documentNode);

  const customScalarInfos =
    collectedScalars !== null ? buildCustomScalarInfos(collectedScalars) : [];
  const resolverInfo = collectResolverInfo(integratedResult, customScalarInfos);
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
