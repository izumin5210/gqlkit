import type { DeprecationInfo } from "../shared/tsdoc-parser.js";
import { createProgramFromFiles } from "../type-extractor/extractor/type-extractor.js";
import type {
  Diagnostic,
  Diagnostics,
  GraphQLFieldType,
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import {
  type ArgumentDefinition,
  type DefineApiResolverInfo,
  extractDefineApiResolvers,
} from "./extractor/define-api-extractor.js";
import { scanResolverDirectory } from "./scanner/file-scanner.js";

export interface GraphQLInputValue {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface GraphQLFieldDefinition {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly args: ReadonlyArray<GraphQLInputValue> | null;
  readonly sourceLocation: SourceLocation;
  readonly resolverExportName: string | null;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
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

export interface ExtractResolversOptions {
  readonly directory: string;
}

export interface ExtractResolversResult {
  readonly queryFields: QueryFieldDefinitions;
  readonly mutationFields: MutationFieldDefinitions;
  readonly typeExtensions: ReadonlyArray<TypeExtension>;
  readonly diagnostics: Diagnostics;
}

function createEmptyResult(diagnostics: Diagnostics): ExtractResolversResult {
  return {
    queryFields: { fields: [] },
    mutationFields: { fields: [] },
    typeExtensions: [],
    diagnostics,
  };
}

function getDiagnosticKey(d: Diagnostic): string {
  const locationKey = d.location
    ? `${d.location.file}:${d.location.line}:${d.location.column}`
    : "";
  return `${d.code}:${d.message}:${d.severity}:${locationKey}`;
}

function deduplicateDiagnostics(
  diagnostics: ReadonlyArray<Diagnostic>,
): Diagnostic[] {
  const seen = new Set<string>();
  const result: Diagnostic[] = [];

  for (const d of diagnostics) {
    const key = getDiagnosticKey(d);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
    }
  }

  return result;
}

function collectDiagnostics(
  allDiagnostics: ReadonlyArray<Diagnostic>,
): Diagnostics {
  const uniqueDiagnostics = deduplicateDiagnostics(allDiagnostics);
  const errors = uniqueDiagnostics.filter((d) => d.severity === "error");
  const warnings = uniqueDiagnostics.filter((d) => d.severity === "warning");

  return { errors, warnings };
}

const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  string: "String",
  number: "Float",
  boolean: "Boolean",
};

function convertTsTypeToGraphQLType(tsType: TSTypeReference): {
  typeName: string;
  nullable: boolean;
  list: boolean;
  listItemNullable: boolean | null;
} {
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

  return {
    typeName: tsType.name ?? "String",
    nullable,
    list: false,
    listItemNullable: null,
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

function convertDefineApiToFields(
  resolvers: ReadonlyArray<DefineApiResolverInfo>,
): {
  queryFields: QueryFieldDefinitions;
  mutationFields: MutationFieldDefinitions;
  typeExtensions: ReadonlyArray<TypeExtension>;
} {
  const queryFields: GraphQLFieldDefinition[] = [];
  const mutationFields: GraphQLFieldDefinition[] = [];
  const typeExtensionMap = new Map<string, GraphQLFieldDefinition[]>();

  for (const resolver of resolvers) {
    const fieldDef: GraphQLFieldDefinition = {
      name: resolver.fieldName,
      type: convertTsTypeToGraphQLType(resolver.returnType),
      args: resolver.args ? convertArgsToInputValues(resolver.args) : null,
      sourceLocation: {
        file: resolver.sourceFile,
        line: 1,
        column: 1,
      },
      resolverExportName: resolver.fieldName,
      description: resolver.description,
      deprecated: resolver.deprecated,
    };

    if (resolver.resolverType === "query") {
      queryFields.push(fieldDef);
    } else if (resolver.resolverType === "mutation") {
      mutationFields.push(fieldDef);
    } else if (resolver.resolverType === "field" && resolver.parentTypeName) {
      const existing = typeExtensionMap.get(resolver.parentTypeName) ?? [];
      existing.push(fieldDef);
      typeExtensionMap.set(resolver.parentTypeName, existing);
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
  };
}

function convertArgsToInputValues(
  args: ReadonlyArray<ArgumentDefinition>,
): GraphQLInputValue[] {
  return args.map((arg) => ({
    name: arg.name,
    type: {
      ...convertTsTypeToGraphQLType(arg.tsType),
      nullable: arg.tsType.nullable || arg.optional,
    },
    description: arg.description,
    deprecated: arg.deprecated,
  }));
}

export async function extractResolvers(
  options: ExtractResolversOptions,
): Promise<ExtractResolversResult> {
  const allDiagnostics: Diagnostic[] = [];

  const scanResult = await scanResolverDirectory(options.directory);
  allDiagnostics.push(...scanResult.errors);

  if (scanResult.errors.length > 0 || scanResult.files.length === 0) {
    return createEmptyResult(collectDiagnostics(allDiagnostics));
  }

  const program = createProgramFromFiles(scanResult.files);

  const defineApiExtractionResult = extractDefineApiResolvers(
    program,
    scanResult.files,
  );
  allDiagnostics.push(...defineApiExtractionResult.diagnostics);

  const result = convertDefineApiToFields(defineApiExtractionResult.resolvers);
  return {
    queryFields: result.queryFields,
    mutationFields: result.mutationFields,
    typeExtensions: result.typeExtensions,
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}
