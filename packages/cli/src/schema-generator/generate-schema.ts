import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import type { ExtractTypesResult } from "../type-extractor/index.js";
import type { Diagnostic } from "../type-extractor/types/index.js";
import { emitResolversCode, emitTypeDefsCode } from "./emitter/code-emitter.js";
import {
  type IntegratedResult,
  integrate,
} from "./integrator/result-integrator.js";
import { collectResolverInfo } from "./resolver-collector/resolver-collector.js";

export interface GenerateSchemaInput {
  readonly typesResult: ExtractTypesResult;
  readonly resolversResult: ExtractResolversResult;
  readonly outputDir: string;
}

export interface GenerateSchemaResult {
  readonly typeDefsCode: string;
  readonly resolversCode: string;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly hasErrors: boolean;
}

export function generateSchema(
  input: GenerateSchemaInput,
): GenerateSchemaResult {
  const { typesResult, resolversResult, outputDir } = input;

  const integratedResult = integrate(typesResult, resolversResult);

  const typeDefsCode = emitTypeDefsCode(integratedResult);

  const resolverInfo = collectResolverInfo(integratedResult);
  const resolversCode = emitResolversCode(resolverInfo, outputDir);

  return {
    typeDefsCode,
    resolversCode,
    diagnostics: integratedResult.diagnostics,
    hasErrors: integratedResult.hasErrors,
  };
}
