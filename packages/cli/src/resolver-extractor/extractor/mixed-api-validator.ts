import type { Diagnostic } from "../../type-extractor/types/index.js";
import type { ExtractDefineApiResult } from "./define-api-extractor.js";
import type { ExtractedResolvers } from "./resolver-extractor.js";

export type ApiStyle = "legacy" | "define-api";

export interface ApiStyleLocation {
  readonly file: string;
  readonly line: number;
  readonly identifier: string;
}

export interface ApiStyleDetection {
  readonly style: ApiStyle;
  readonly locations: ReadonlyArray<ApiStyleLocation>;
}

export interface MixedApiValidationResult {
  readonly valid: boolean;
  readonly detectedStyles: ReadonlyArray<ApiStyleDetection>;
  readonly diagnostic?: Diagnostic;
}

export function validateApiStyleConsistency(
  legacyResolvers: ExtractedResolvers,
  defineApiResolvers: ExtractDefineApiResult,
): MixedApiValidationResult {
  const hasLegacy = legacyResolvers.resolvers.length > 0;
  const hasDefineApi = defineApiResolvers.resolvers.length > 0;

  if (!hasLegacy && !hasDefineApi) {
    return {
      valid: true,
      detectedStyles: [],
    };
  }

  const detectedStyles: ApiStyleDetection[] = [];

  if (hasLegacy) {
    detectedStyles.push({
      style: "legacy",
      locations: legacyResolvers.resolvers.map((r) => ({
        file: r.sourceFile,
        line: 1,
        identifier: r.typeName,
      })),
    });
  }

  if (hasDefineApi) {
    detectedStyles.push({
      style: "define-api",
      locations: defineApiResolvers.resolvers.map((r) => ({
        file: r.sourceFile,
        line: 1,
        identifier: r.fieldName,
      })),
    });
  }

  if (hasLegacy && hasDefineApi) {
    const legacyLocations = legacyResolvers.resolvers
      .map((r) => `  - ${r.sourceFile}: ${r.typeName}`)
      .join("\n");
    const defineApiLocations = defineApiResolvers.resolvers
      .map((r) => `  - ${r.sourceFile}: ${r.fieldName}`)
      .join("\n");

    return {
      valid: false,
      detectedStyles,
      diagnostic: {
        code: "LEGACY_API_DETECTED",
        message: `Cannot mix legacy resolver API with define* API.

Legacy API detected:
${legacyLocations}

Define* API detected:
${defineApiLocations}

Migrate all resolvers to use defineQuery, defineMutation, or defineField from @gqlkit-ts/runtime.`,
        severity: "error",
        location: {
          file: legacyResolvers.resolvers[0]?.sourceFile ?? "",
          line: 1,
          column: 1,
        },
      },
    };
  }

  return {
    valid: true,
    detectedStyles,
  };
}
