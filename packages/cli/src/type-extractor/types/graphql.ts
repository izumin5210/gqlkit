import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";

export type GraphQLTypeKind = "Object" | "Union" | "Enum" | "InputObject";

export interface GraphQLFieldType {
  readonly typeName: string;
  readonly nullable: boolean;
  readonly list: boolean;
  readonly listItemNullable?: boolean | undefined;
}

export interface FieldInfo {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description?: string | undefined;
  readonly deprecated?: DeprecationInfo | undefined;
}

export interface EnumValueInfo {
  readonly name: string;
  readonly originalValue: string;
  readonly description?: string | undefined;
  readonly deprecated?: DeprecationInfo | undefined;
}

export interface GraphQLTypeInfo {
  readonly name: string;
  readonly kind: GraphQLTypeKind;
  readonly fields?: ReadonlyArray<FieldInfo> | undefined;
  readonly unionMembers?: ReadonlyArray<string> | undefined;
  readonly enumValues?: ReadonlyArray<EnumValueInfo> | undefined;
  readonly sourceFile: string;
  readonly description?: string | undefined;
  readonly deprecated?: DeprecationInfo | undefined;
}
