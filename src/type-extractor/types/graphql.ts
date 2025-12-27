export type GraphQLTypeKind = "Object" | "Union" | "Enum";

export interface GraphQLFieldType {
  readonly typeName: string;
  readonly nullable: boolean;
  readonly list: boolean;
  readonly listItemNullable?: boolean;
}

export interface FieldInfo {
  readonly name: string;
  readonly type: GraphQLFieldType;
}

export interface EnumValueInfo {
  readonly name: string;
  readonly originalValue: string;
}

export interface GraphQLTypeInfo {
  readonly name: string;
  readonly kind: GraphQLTypeKind;
  readonly fields?: ReadonlyArray<FieldInfo>;
  readonly unionMembers?: ReadonlyArray<string>;
  readonly enumValues?: ReadonlyArray<EnumValueInfo>;
  readonly sourceFile: string;
}
