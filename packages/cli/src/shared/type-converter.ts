import type {
  GraphQLFieldType,
  TSTypeReference,
} from "../type-extractor/types/index.js";

const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  string: "String",
  number: "Float",
  boolean: "Boolean",
};

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
  return elementType.name ?? "String";
}

export function convertTsTypeToGraphQLType(
  tsType: TSTypeReference,
  optional = false,
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

  return {
    typeName: tsType.name ?? "String",
    nullable,
    list: false,
    listItemNullable: null,
  };
}
