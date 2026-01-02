import type { ScalarTypeInfo } from "../../shared/branded-detector.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";

export type TypeKind = "object" | "interface" | "union" | "enum";

export interface TypeMetadata {
  readonly name: string;
  readonly kind: TypeKind;
  readonly sourceFile: string;
  readonly exportKind: "named" | "default";
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface TSTypeReference {
  readonly kind:
    | "primitive"
    | "reference"
    | "array"
    | "union"
    | "literal"
    | "scalar";
  readonly name: string | null;
  readonly elementType: TSTypeReference | null;
  readonly members: ReadonlyArray<TSTypeReference> | null;
  readonly nullable: boolean;
  readonly scalarInfo: ScalarTypeInfo | null;
}

export interface FieldDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface EnumMemberInfo {
  readonly name: string;
  readonly value: string;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface ExtractedTypeInfo {
  readonly metadata: TypeMetadata;
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly unionMembers: ReadonlyArray<string> | null;
  readonly enumMembers: ReadonlyArray<EnumMemberInfo> | null;
}
