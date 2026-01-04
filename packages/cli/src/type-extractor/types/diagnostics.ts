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
  | "MISSING_PARENT_TYPE"
  | "UNSUPPORTED_ENUM_TYPE"
  | "INVALID_ENUM_MEMBER"
  | "INVALID_INPUT_TYPE"
  | "UNKNOWN_ARGUMENT_TYPE"
  | "OUTPUT_TYPE_IN_INPUT"
  | "CIRCULAR_INPUT_REFERENCE"
  | "UNKNOWN_BRANDED_SCALAR"
  | "INVALID_SCALAR_IMPORT"
  | "CONFLICTING_SCALAR_TYPE"
  | "INVALID_DEFINE_CALL"
  | "CONFIG_SYNTAX_ERROR"
  | "CONFIG_MISSING_PROPERTY"
  | "CONFIG_INVALID_TYPE"
  | "CONFIG_INVALID_PATH"
  | "CONFIG_BUILTIN_OVERRIDE"
  | "CONFIG_DUPLICATE_MAPPING"
  | "CONFIG_DUPLICATE_TYPE"
  | "CONFIG_INVALID_OUTPUT_TYPE"
  | "CONFIG_INVALID_OUTPUT_PATH"
  | "CONFIG_INVALID_SOURCE_DIR"
  | "CONFIG_INVALID_IGNORE_GLOBS"
  | "CUSTOM_SCALAR_TYPE_NOT_FOUND"
  | "TSCONFIG_NOT_FOUND"
  | "TSCONFIG_PARSE_ERROR"
  | "TSCONFIG_INVALID"
  | "ONEOF_FIELD_NAME_CONFLICT"
  | "FIELD_AUTO_EXCLUDED"
  | "ALL_FIELDS_EXCLUDED";

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly location: SourceLocation | null;
}

export interface Diagnostics {
  readonly errors: ReadonlyArray<Diagnostic>;
  readonly warnings: ReadonlyArray<Diagnostic>;
}

export type ExclusionReason =
  | { kind: "unsupported_type"; typeName: string }
  | { kind: "underscore_prefix" };

export interface ExcludedFieldInfo {
  readonly fieldName: string;
  readonly typeName: string;
  readonly reason: ExclusionReason;
  readonly location: SourceLocation;
}
