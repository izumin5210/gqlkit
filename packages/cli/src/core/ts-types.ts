import type ts from "typescript";
import type { SourceLocation } from "./diagnostics.js";
import type {
  DeprecationInfo,
  DirectiveArgumentValue,
  DirectiveInfo,
} from "./metadata.js";

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

export type TSTypeReferenceKind =
  | "primitive"
  | "reference"
  | "array"
  | "union"
  | "stringLiteral"
  | "numericLiteral"
  | "scalar"
  | "inlineObject"
  | "inlineEnum"
  | "never";

/**
 * Information about an inline enum member (string literal union value).
 */
export interface InlineEnumMemberInfo {
  /** Original value from TypeScript (e.g., "pendingReview") */
  readonly value: string;
  /** Description from TSDoc (if available) */
  readonly description: string | null;
  /** Deprecation info from @deprecated tag */
  readonly deprecated: DeprecationInfo | null;
}

export interface TSTypeReference {
  readonly kind: TSTypeReferenceKind;
  readonly name: string | null;
  readonly elementType: TSTypeReference | null;
  readonly members: ReadonlyArray<TSTypeReference> | null;
  readonly nullable: boolean;
  readonly scalarInfo: ScalarTypeInfo | null;
  readonly inlineObjectProperties: ReadonlyArray<InlineObjectPropertyDef> | null;
  /** TSDoc description from the inline object type alias (Requirement 7.2) */
  readonly inlineObjectDescription: string | null;
  /** Deprecation info from the `@deprecated` TSDoc tag on the inline object type alias (Requirement 7.3) */
  readonly inlineObjectDeprecated: DeprecationInfo | null;
  /** Inline enum members when kind is "inlineEnum" */
  readonly inlineEnumMembers: ReadonlyArray<InlineEnumMemberInfo> | null;
  /** Original type name hint for inline objects extracted from external types */
  readonly inlineObjectHintName: string | null;
  /** External TypeScript enum symbol for deduplication (Requirement 5.2) */
  readonly externalEnumSymbol: ts.Symbol | null;
  /** TSDoc description from the external enum type itself (Requirement 6.1) */
  readonly externalEnumDescription: string | null;
  /** Deprecation info from the `@deprecated` TSDoc tag on the external enum type itself (Requirement 6.3) */
  readonly externalEnumDeprecated: DeprecationInfo | null;
}

export interface InlineObjectPropertyDef {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
  readonly defaultValue: DirectiveArgumentValue | null;
  readonly sourceLocation: SourceLocation | null;
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
