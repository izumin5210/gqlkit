import type {
  DirectiveArgumentValue,
  DirectiveInfo,
} from "../../shared/directive-detector.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";

export type TypeKind =
  | "object"
  | "interface"
  | "union"
  | "enum"
  | "graphqlInterface";

/**
 * Information about a detected scalar type.
 */
export interface ScalarTypeInfo {
  /** The GraphQL scalar type name (ID, Int, Float, String, Boolean, or custom scalar name) */
  readonly scalarName: string;
  /** The TypeScript type name (e.g., "IDString", "Int", "DateTime") */
  readonly typeName: string;
  /** The underlying TypeScript primitive type (undefined for custom scalars) */
  readonly baseType: "string" | "number" | undefined;
  /** Whether this is a custom scalar */
  readonly isCustom: boolean;
  /** Usage constraint: "input" for input-only, "output" for output-only, null for both */
  readonly only: "input" | "output" | null;
}

export interface TypeMetadata {
  readonly name: string;
  readonly kind: TypeKind;
  readonly sourceFile: string;
  readonly exportKind: "named" | "default";
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
}

export type TSTypeReferenceKind =
  | "primitive"
  | "reference"
  | "array"
  | "union"
  | "literal"
  | "scalar"
  | "inlineObject";

export interface TSTypeReference {
  readonly kind: TSTypeReferenceKind;
  readonly name: string | null;
  readonly elementType: TSTypeReference | null;
  readonly members: ReadonlyArray<TSTypeReference> | null;
  readonly nullable: boolean;
  readonly scalarInfo: ScalarTypeInfo | null;
  readonly inlineObjectProperties: ReadonlyArray<InlineObjectPropertyDef> | null;
}

export interface InlineObjectPropertyDef {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
  readonly defaultValue: DirectiveArgumentValue | null;
}

export interface FieldDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
  readonly defaultValue: DirectiveArgumentValue | null;
}

export interface EnumMemberInfo {
  readonly name: string;
  readonly value: string;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface InlineObjectProperty {
  readonly propertyName: string;
  readonly propertyType: TSTypeReference;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface InlineObjectMember {
  readonly properties: ReadonlyArray<InlineObjectProperty>;
}

export interface ExtractedTypeInfo {
  readonly metadata: TypeMetadata;
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly unionMembers: ReadonlyArray<string> | null;
  readonly inlineObjectMembers: ReadonlyArray<InlineObjectMember> | null;
  readonly enumMembers: ReadonlyArray<EnumMemberInfo> | null;
  readonly implementedInterfaces: ReadonlyArray<string> | null;
}
