export type TypeKind = "object" | "interface" | "union" | "enum";

export interface TypeMetadata {
  readonly name: string;
  readonly kind: TypeKind;
  readonly sourceFile: string;
  readonly exportKind: "named" | "default";
}

export interface TSTypeReference {
  readonly kind: "primitive" | "reference" | "array" | "union" | "literal";
  readonly name?: string;
  readonly elementType?: TSTypeReference;
  readonly members?: ReadonlyArray<TSTypeReference>;
  readonly nullable: boolean;
}

export interface FieldDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
}

export interface EnumMemberInfo {
  readonly name: string;
  readonly value: string;
}

export interface ExtractedTypeInfo {
  readonly metadata: TypeMetadata;
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly unionMembers?: ReadonlyArray<string>;
  readonly enumMembers?: ReadonlyArray<EnumMemberInfo>;
}
