import {
  type GraphQLFieldType,
  PRIMITIVE_TYPE_MAP,
  type TSTypeReference,
} from "../core/index.js";

const GRAPHQL_INT_MIN = -(2 ** 31);
const GRAPHQL_INT_MAX = 2 ** 31 - 1;

function numericLiteralToGraphQLScalar(name: string | null): string {
  const num = Number(name);
  if (
    Number.isInteger(num) &&
    num >= GRAPHQL_INT_MIN &&
    num <= GRAPHQL_INT_MAX
  ) {
    return "Int";
  }
  return "Float";
}

function convertElementTypeName(elementType: TSTypeReference): string {
  if (elementType.kind === "scalar") {
    return elementType.scalarInfo?.scalarName ?? elementType.name ?? "String";
  }
  if (elementType.kind === "primitive") {
    return PRIMITIVE_TYPE_MAP[elementType.name ?? ""] ?? "String";
  }
  if (elementType.kind === "reference") {
    return elementType.name ?? "Unknown";
  }
  if (elementType.kind === "inlineObject") {
    return "__INLINE_OBJECT__";
  }
  if (elementType.kind === "inlineEnum") {
    return "__INLINE_ENUM__";
  }
  if (elementType.kind === "union") {
    return "__INLINE_UNION__";
  }
  if (elementType.kind === "stringLiteral") {
    return "String";
  }
  if (elementType.kind === "numericLiteral") {
    return numericLiteralToGraphQLScalar(elementType.name);
  }
  if (elementType.kind === "never") {
    return "__NEVER__";
  }
  return elementType.name ?? "String";
}

export function convertTsTypeToGraphQLType(
  tsType: TSTypeReference,
  optional: boolean,
): GraphQLFieldType {
  const nullable = tsType.nullable || optional;

  if (tsType.kind === "array") {
    const innerListNullables: boolean[] = [];
    let elementType = tsType.elementType;
    while (elementType?.kind === "array") {
      innerListNullables.push(elementType.nullable);
      elementType = elementType.elementType;
    }

    return {
      typeName: elementType ? convertElementTypeName(elementType) : "String",
      nullable,
      list: true,
      listItemNullable: elementType?.nullable ?? false,
      innerListNullables,
    };
  }

  return {
    typeName: convertElementTypeName(tsType),
    nullable,
    list: false,
    listItemNullable: null,
    innerListNullables: [],
  };
}
