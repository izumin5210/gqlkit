export { collectDiagnostics, deduplicateDiagnostics } from "./diagnostics.js";
export {
  type DirectiveArgument,
  type DirectiveArgumentValue,
  type DirectiveDetectionError,
  type DirectiveDetectionErrorCode,
  type DirectiveDetectionResult,
  type DirectiveInfo,
  detectDirectiveMetadata,
  hasDirectiveMetadata,
  unwrapWithDirectivesType,
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
