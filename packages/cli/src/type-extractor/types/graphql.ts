import type { DirectiveInfo } from "../../shared/directive-detector.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";

export type GraphQLTypeKind =
  | "Object"
  | "Union"
  | "Enum"
  | "InputObject"
  | "OneOfInputObject";

export interface GraphQLFieldType {
  readonly typeName: string;
  readonly nullable: boolean;
  readonly list: boolean;
  readonly listItemNullable: boolean | null;
}

export interface FieldInfo {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
}

export interface EnumValueInfo {
  readonly name: string;
  readonly originalValue: string;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface GraphQLTypeInfo {
  readonly name: string;
  readonly kind: GraphQLTypeKind;
  readonly fields: ReadonlyArray<FieldInfo> | null;
  readonly unionMembers: ReadonlyArray<string> | null;
  readonly enumValues: ReadonlyArray<EnumValueInfo> | null;
  readonly sourceFile: string;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
}
