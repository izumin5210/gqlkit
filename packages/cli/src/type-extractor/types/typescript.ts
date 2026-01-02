import type { ScalarTypeInfo } from "../../shared/branded-detector.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";

export type TypeKind = "object" | "interface" | "union" | "enum";

export interface TypeMetadata {
  readonly name: string;
  readonly kind: TypeKind;
  readonly sourceFile: string;
  readonly exportKind: "named" | "default";
  readonly description?: string | undefined;
  readonly deprecated?: DeprecationInfo | undefined;
}

export interface TSTypeReference {
  readonly kind:
    | "primitive"
    | "reference"
    | "array"
    | "union"
    | "literal"
    | "scalar";
  readonly name?: string | undefined;
  readonly elementType?: TSTypeReference | undefined;
  readonly members?: ReadonlyArray<TSTypeReference> | undefined;
  readonly nullable: boolean;
  readonly scalarInfo?: ScalarTypeInfo | undefined;
}

export interface FieldDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description?: string | undefined;
  readonly deprecated?: DeprecationInfo | undefined;
}

export interface EnumMemberInfo {
  readonly name: string;
  readonly value: string;
  readonly description?: string | undefined;
  readonly deprecated?: DeprecationInfo | undefined;
}

export interface ExtractedTypeInfo {
  readonly metadata: TypeMetadata;
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly unionMembers?: ReadonlyArray<string> | undefined;
  readonly enumMembers?: ReadonlyArray<EnumMemberInfo> | undefined;
}
