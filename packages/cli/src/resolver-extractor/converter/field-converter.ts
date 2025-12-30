import type {
  Diagnostic,
  GraphQLFieldType,
  SourceLocation,
  TSTypeReference,
} from "../../type-extractor/types/index.js";
import type {
  AnalyzedField,
  AnalyzedResolver,
  AnalyzedResolvers,
  ArgumentDefinition,
} from "../analyzer/signature-analyzer.js";

export interface GraphQLInputValue {
  readonly name: string;
  readonly type: GraphQLFieldType;
}

export interface GraphQLFieldDefinition {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly args?: ReadonlyArray<GraphQLInputValue>;
  readonly sourceLocation: SourceLocation;
  readonly resolverExportName?: string;
}

export interface QueryFieldDefinitions {
  readonly fields: ReadonlyArray<GraphQLFieldDefinition>;
}

export interface MutationFieldDefinitions {
  readonly fields: ReadonlyArray<GraphQLFieldDefinition>;
}

export interface TypeExtension {
  readonly targetTypeName: string;
  readonly fields: ReadonlyArray<GraphQLFieldDefinition>;
}

export interface ConvertedFields {
  readonly queryFields: QueryFieldDefinitions;
  readonly mutationFields: MutationFieldDefinitions;
  readonly typeExtensions: ReadonlyArray<TypeExtension>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  string: "String",
  number: "Int",
  boolean: "Boolean",
};

function convertTsTypeToGraphQL(tsType: TSTypeReference): GraphQLFieldType {
  const nullable = tsType.nullable;

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

function convertArgsToInputValues(
  args: ReadonlyArray<ArgumentDefinition>,
): GraphQLInputValue[] {
  return args.map((arg) => ({
    name: arg.name,
    type: convertTsTypeToGraphQL({
      ...arg.tsType,
      nullable: arg.tsType.nullable || arg.optional,
    }),
  }));
}

function convertAnalyzedFieldToGraphQL(
  field: AnalyzedField,
  sourceFile: string,
): GraphQLFieldDefinition {
  const args =
    field.args && field.args.length > 0
      ? convertArgsToInputValues(field.args)
      : undefined;

  return {
    name: field.name,
    type: convertTsTypeToGraphQL(field.returnType),
    args,
    sourceLocation: {
      file: sourceFile,
      line: 1,
      column: 1,
    },
  };
}

function convertResolverToFields(
  resolver: AnalyzedResolver,
): GraphQLFieldDefinition[] {
  return resolver.fields.map((field) =>
    convertAnalyzedFieldToGraphQL(field, resolver.pair.sourceFile),
  );
}

export function convertToFields(
  analyzedResolvers: AnalyzedResolvers,
): ConvertedFields {
  const queryFields: GraphQLFieldDefinition[] = [];
  const mutationFields: GraphQLFieldDefinition[] = [];
  const typeExtensionMap = new Map<string, GraphQLFieldDefinition[]>();
  const diagnostics: Diagnostic[] = [];

  for (const resolver of analyzedResolvers.resolvers) {
    const fields = convertResolverToFields(resolver);

    if (resolver.pair.category === "query") {
      queryFields.push(...fields);
    } else if (resolver.pair.category === "mutation") {
      mutationFields.push(...fields);
    } else {
      const targetTypeName = resolver.pair.targetTypeName;
      const existing = typeExtensionMap.get(targetTypeName) ?? [];
      existing.push(...fields);
      typeExtensionMap.set(targetTypeName, existing);
    }
  }

  const typeExtensions: TypeExtension[] = [];
  for (const [targetTypeName, fields] of typeExtensionMap) {
    typeExtensions.push({ targetTypeName, fields });
  }

  return {
    queryFields: { fields: queryFields },
    mutationFields: { fields: mutationFields },
    typeExtensions,
    diagnostics,
  };
}
