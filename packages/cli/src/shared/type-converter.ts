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
    const elementType = tsType.elementType;
    const elementTypeName = elementType
      ? convertElementTypeName(elementType)
      : "String";
    const listItemNullable = elementType?.nullable ?? false;

    return {
      typeName: elementTypeName,
      nullable,
      list: true,
      listItemNullable,
    };
  }

  if (tsType.kind === "scalar") {
    return {
      typeName: tsType.scalarInfo?.scalarName ?? tsType.name ?? "String",
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "primitive") {
    const graphqlType = PRIMITIVE_TYPE_MAP[tsType.name ?? ""] ?? "String";
    return {
      typeName: graphqlType,
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "reference") {
    return {
      typeName: tsType.name ?? "Unknown",
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "inlineObject") {
    return {
      typeName: "__INLINE_OBJECT__",
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "inlineEnum") {
    return {
      typeName: "__INLINE_ENUM__",
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "union") {
    return {
      typeName: "__INLINE_UNION__",
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "stringLiteral") {
    return {
      typeName: "String",
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "numericLiteral") {
    return {
      typeName: numericLiteralToGraphQLScalar(tsType.name),
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  if (tsType.kind === "never") {
    return {
      typeName: "__NEVER__",
      nullable,
      list: false,
      listItemNullable: null,
    };
  }

  return {
    typeName: tsType.name ?? "String",
    nullable,
    list: false,
    listItemNullable: null,
  };
}
