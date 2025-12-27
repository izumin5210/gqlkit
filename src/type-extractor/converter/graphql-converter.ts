import type {
  Diagnostic,
  ExtractedTypeInfo,
  FieldInfo,
  GraphQLFieldType,
  GraphQLTypeInfo,
  TSTypeReference,
} from "../types/index.js";

export interface ConversionResult {
  readonly types: ReadonlyArray<GraphQLTypeInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const RESERVED_TYPE_NAMES = new Set([
  "Int",
  "Float",
  "String",
  "Boolean",
  "ID",
  "Query",
  "Mutation",
  "Subscription",
]);

const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  string: "String",
  number: "Int",
  boolean: "Boolean",
};

function convertTsTypeToGraphQL(
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

  if (tsType.kind === "primitive") {
    const graphqlType = PRIMITIVE_TYPE_MAP[tsType.name ?? ""] ?? "String";
    return {
      typeName: graphqlType,
      nullable,
      list: false,
    };
  }

  if (tsType.kind === "reference") {
    return {
      typeName: tsType.name ?? "Unknown",
      nullable,
      list: false,
    };
  }

  return {
    typeName: tsType.name ?? "String",
    nullable,
    list: false,
  };
}

function convertElementTypeName(elementType: TSTypeReference): string {
  if (elementType.kind === "primitive") {
    return PRIMITIVE_TYPE_MAP[elementType.name ?? ""] ?? "String";
  }
  if (elementType.kind === "reference") {
    return elementType.name ?? "Unknown";
  }
  return elementType.name ?? "String";
}

function convertFields(extracted: ExtractedTypeInfo): FieldInfo[] {
  return extracted.fields.map((field) => ({
    name: field.name,
    type: convertTsTypeToGraphQL(field.tsType, field.optional),
  }));
}

export function convertToGraphQL(
  extractedTypes: ReadonlyArray<ExtractedTypeInfo>,
): ConversionResult {
  const types: GraphQLTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const extracted of extractedTypes) {
    const { metadata } = extracted;

    if (RESERVED_TYPE_NAMES.has(metadata.name)) {
      diagnostics.push({
        code: "RESERVED_TYPE_NAME",
        message: `Type name '${metadata.name}' conflicts with a GraphQL built-in type`,
        severity: "error",
        location: { file: metadata.sourceFile, line: 1, column: 1 },
      });
    }

    if (metadata.kind === "union") {
      const unionMembers = extracted.unionMembers
        ? [...extracted.unionMembers].sort()
        : [];

      types.push({
        name: metadata.name,
        kind: "Union",
        unionMembers,
        sourceFile: metadata.sourceFile,
      });
    } else {
      const fields = convertFields(extracted);

      types.push({
        name: metadata.name,
        kind: "Object",
        fields,
        sourceFile: metadata.sourceFile,
      });
    }
  }

  return { types, diagnostics };
}
