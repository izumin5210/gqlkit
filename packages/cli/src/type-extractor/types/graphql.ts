import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";

export type GraphQLTypeKind = "Object" | "Union" | "Enum" | "InputObject";

export interface GraphQLFieldType {
  readonly typeName: string;
  readonly nullable: boolean;
  readonly list: boolean;
  readonly listItemNullable?: boolean;
}

export interface FieldInfo {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface EnumValueInfo {
  readonly name: string;
  readonly originalValue: string;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface GraphQLTypeInfo {
  readonly name: string;
  readonly kind: GraphQLTypeKind;
  readonly fields?: ReadonlyArray<FieldInfo>;
  readonly unionMembers?: ReadonlyArray<string>;
  readonly enumValues?: ReadonlyArray<EnumValueInfo>;
  readonly sourceFile: string;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}
