export type {
  DefaultValueDetectionError,
  DefaultValueDetectionErrorCode,
  DefaultValueDetectionResult,
} from "./default-value-detector.js";
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
export {
  
  type TypeConverter,
} from "./inline-object-extractor.js";
export {
  
  
  type SourceLocation,
} from "./source-location.js";
export { convertTsTypeToGraphQLType } from "./type-converter.js";
;

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
