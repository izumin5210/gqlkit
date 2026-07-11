import type {
  DeprecationInfo,
  DirectiveInfo,
  InlineObjectMember,
  PropertyDef,
  SourceLocation,
} from "../../core/index.js";

export type TypeKind =
  | "object"
  | "interface"
  | "union"
  | "enum"
  | "graphqlInterface";

/**
 * Global type mapping configuration.
 * Maps TypeScript type names to GraphQL scalar names when tsType.from is omitted.
 *
 * Lives here (rather than in extractor/type-extractor.ts, where it originated)
 * so that both type-extractor.ts and field-type-resolver.ts can depend on it
 * without depending on each other — refactor-plan.md §1.4/Phase 1 note,
 * Phase 8 item 3: this was the last file-level `no-circular` cycle owned by
 * this stage.
 */
export interface GlobalTypeMapping {
  /** TypeScript type name (e.g., "Date", "URL") */
  readonly typeName: string;
  /** GraphQL scalar name (e.g., "DateTime", "URL") */
  readonly scalarName: string;
  /** Usage constraint */
  readonly only: "input" | "output" | null;
}

export interface TypeMetadata {
  readonly name: string;
  readonly kind: TypeKind;
  readonly sourceFile: string;
  readonly sourceLocation: SourceLocation;
  readonly exportKind: "named" | "default";
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
}

export interface EnumMemberInfo {
  readonly name: string;
  readonly value: string;
  /** Numeric value for numeric enums, null for string enums */
  readonly numericValue: number | null;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly sourceLocation: SourceLocation | null;
}

export interface ExtractedTypeInfo {
  readonly metadata: TypeMetadata;
  readonly fields: ReadonlyArray<PropertyDef>;
  readonly unionMembers: ReadonlyArray<string> | null;
  readonly inlineObjectMembers: ReadonlyArray<InlineObjectMember> | null;
  readonly enumMembers: ReadonlyArray<EnumMemberInfo> | null;
  readonly implementedInterfaces: ReadonlyArray<string> | null;
}
