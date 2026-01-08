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
  type InterfaceDetectionResult,
  detectInterfaceMetadata,
  extractImplementedInterfaces,
  extractImplementsFromDefineInterface,
  extractImplementsFromGqlTypeDef,
  isDefineInterfaceTypeAlias,
  isGraphQLInterfaceType,
} from "./interface-detector.js";
export { convertTsTypeToGraphQLType } from "./type-converter.js";

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
