import type { ScalarTypeInfo } from "../../shared/branded-detector.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";

export type TypeKind = "object" | "interface" | "union" | "enum";

export interface TypeMetadata {
  readonly name: string;
  readonly kind: TypeKind;
  readonly sourceFile: string;
  readonly exportKind: "named" | "default";
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface TSTypeReference {
  readonly kind:
    | "primitive"
    | "reference"
    | "array"
    | "union"
    | "literal"
    | "scalar";
  readonly name?: string;
  readonly elementType?: TSTypeReference;
  readonly members?: ReadonlyArray<TSTypeReference>;
  readonly nullable: boolean;
  readonly scalarInfo?: ScalarTypeInfo;
}

export interface FieldDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface EnumMemberInfo {
  readonly name: string;
  readonly value: string;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface ExtractedTypeInfo {
  readonly metadata: TypeMetadata;
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly unionMembers?: ReadonlyArray<string>;
  readonly enumMembers?: ReadonlyArray<EnumMemberInfo>;
}
