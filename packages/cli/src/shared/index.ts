export {
  type DefaultValueParseResult,
  parseDefaultValue,
} from "./default-value-parser.js";
export { collectDiagnostics, deduplicateDiagnostics } from "./diagnostics.js";
export {
  type ScanOptions,
  type ScanResult,
  scanDirectory,
} from "./file-scanner.js";
export type { DefaultValueInfo } from "./tsdoc-parser.js";
export { convertTsTypeToGraphQLType } from "./type-converter.js";

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
