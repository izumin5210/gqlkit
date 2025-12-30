export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export type DiagnosticCode =
  | "DIRECTORY_NOT_FOUND"
  | "PARSE_ERROR"
  | "UNSUPPORTED_SYNTAX"
  | "RESERVED_TYPE_NAME"
  | "UNRESOLVED_REFERENCE"
  | "NAMING_CONVENTION_MISMATCH"
  | "INVALID_RESOLVER_SIGNATURE"
  | "UNSUPPORTED_RETURN_TYPE"
  | "UNSUPPORTED_ARG_TYPE"
  | "UNKNOWN_TARGET_TYPE"
  | "PARENT_TYPE_MISMATCH"
  | "UNSUPPORTED_ENUM_TYPE"
  | "INVALID_ENUM_MEMBER";

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly location?: SourceLocation;
}

export interface Diagnostics {
  readonly errors: ReadonlyArray<Diagnostic>;
  readonly warnings: ReadonlyArray<Diagnostic>;
}
