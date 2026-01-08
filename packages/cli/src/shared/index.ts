export {
  type DefaultValueDetectionError,
  type DefaultValueDetectionErrorCode,
  type DefaultValueDetectionResult,
  detectDefaultValueMetadata,
  hasDefaultValueMetadata,
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
export {
  type DirectiveArgument,
  type DirectiveArgumentValue,
  type DirectiveDetectionError,
  type DirectiveDetectionErrorCode,
  type DirectiveDetectionResult,
  type DirectiveInfo,
  resolveArgumentValue,
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
