export type {
  DefaultValueDetectionError,
  DefaultValueDetectionErrorCode,
  DefaultValueDetectionResult,
} from "./default-value-detector.js";
export {
  extractNullability,
  getNonNullableTypes,
  isNullableUnion,
  isNullOrUndefined,
} from "./typescript-utils.js";
export {
  type SourceLocation,
  getSourceLocationFromNode,
  getSourceLocationFromSymbol,
} from "./source-location.js";
export {
  type TypeConverter,
  extractInlineObjectProperties,
} from "./inline-object-extractor.js";
export { collectDiagnostics, deduplicateDiagnostics } from "./diagnostics.js";
export {
  type DirectiveArgumentDefinition,
  type DirectiveDefinitionError,
  type DirectiveDefinitionErrorCode,
  type DirectiveDefinitionExtractionResult,
  type DirectiveDefinitionInfo,
  type DirectiveLocation,
  extractDirectiveDefinitions,
} from "./directive-definition-extractor.js";
export type {
  DirectiveArgument,
  DirectiveArgumentValue,
  DirectiveDetectionError,
  DirectiveDetectionErrorCode,
  DirectiveDetectionResult,
  DirectiveInfo,
} from "./directive-detector.js";

export {
  type ScanOptions,
  type ScanResult,
  scanDirectory,
} from "./file-scanner.js";
export { convertTsTypeToGraphQLType } from "./type-converter.js";

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
