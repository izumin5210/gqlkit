export type GraphQLTypeKind = "Object" | "Union";

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

export interface GraphQLTypeInfo {
  readonly name: string;
  readonly kind: GraphQLTypeKind;
  readonly fields?: ReadonlyArray<FieldInfo>;
  readonly unionMembers?: ReadonlyArray<string>;
  readonly sourceFile: string;
}
