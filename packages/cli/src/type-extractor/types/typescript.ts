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
