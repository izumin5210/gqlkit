import type {
  DeprecationInfo,
  DirectiveArgumentValue,
  DirectiveInfo,
  InlineObjectMember,
  SourceLocation,
  TSTypeReference,
} from "../../core/index.js";

export type TypeKind =
  | "object"
  | "interface"
  | "union"
  | "enum"
  | "graphqlInterface";

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

export interface FieldDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
  readonly defaultValue: DirectiveArgumentValue | null;
  readonly sourceLocation: SourceLocation | null;
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
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly unionMembers: ReadonlyArray<string> | null;
  readonly inlineObjectMembers: ReadonlyArray<InlineObjectMember> | null;
  readonly enumMembers: ReadonlyArray<EnumMemberInfo> | null;
  readonly implementedInterfaces: ReadonlyArray<string> | null;
}
