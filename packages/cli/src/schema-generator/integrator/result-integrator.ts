import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension as ResolverTypeExtension,
} from "../../resolver-extractor/index.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";
import type { ExtractTypesResult } from "../../type-extractor/index.js";
import type {
  Diagnostic,
  EnumValueInfo,
  GraphQLFieldType,
} from "../../type-extractor/types/index.js";

export interface BaseField {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface BaseType {
  readonly name: string;
  readonly kind: "Object" | "Union" | "Enum";
  readonly fields?: ReadonlyArray<BaseField>;
  readonly unionMembers?: ReadonlyArray<string>;
  readonly enumValues?: ReadonlyArray<EnumValueInfo>;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface InputType {
  readonly name: string;
  readonly fields: ReadonlyArray<BaseField>;
  readonly sourceFile: string;
  readonly description?: string;
}

export interface ExtensionField {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly args?: ReadonlyArray<GraphQLInputValue>;
  readonly resolverSourceFile: string;
  readonly resolverExportName?: string;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface TypeExtension {
  readonly targetTypeName: string;
  readonly fields: ReadonlyArray<ExtensionField>;
}

export interface IntegratedResult {
  readonly baseTypes: ReadonlyArray<BaseType>;
  readonly inputTypes: ReadonlyArray<InputType>;
  readonly typeExtensions: ReadonlyArray<TypeExtension>;
  readonly hasQuery: boolean;
  readonly hasMutation: boolean;
  readonly hasErrors: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

function convertToExtensionField(
  field: GraphQLFieldDefinition,
): ExtensionField {
  return {
    name: field.name,
    type: field.type,
    args: field.args,
    resolverSourceFile: field.sourceLocation.file,
    resolverExportName: field.resolverExportName,
    description: field.description,
    deprecated: field.deprecated,
  };
}

function convertResolverTypeExtension(
  ext: ResolverTypeExtension,
): TypeExtension {
  return {
    targetTypeName: ext.targetTypeName,
    fields: ext.fields.map(convertToExtensionField),
  };
}

export function integrate(
  typesResult: ExtractTypesResult,
  resolversResult: ExtractResolversResult,
): IntegratedResult {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...typesResult.diagnostics.errors);
  diagnostics.push(...typesResult.diagnostics.warnings);
  diagnostics.push(...resolversResult.diagnostics.errors);
  diagnostics.push(...resolversResult.diagnostics.warnings);

  const baseTypes: BaseType[] = [];
  const inputTypes: InputType[] = [];

  for (const type of typesResult.types) {
    if (type.kind === "InputObject") {
      inputTypes.push({
        name: type.name,
        fields:
          type.fields?.map((field) => ({
            name: field.name,
            type: field.type,
            description: field.description,
            deprecated: field.deprecated,
          })) ?? [],
        sourceFile: type.sourceFile,
        description: type.description,
      });
    } else if (type.kind === "Enum") {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        enumValues: type.enumValues,
        description: type.description,
        deprecated: type.deprecated,
      });
    } else if (type.kind === "Object") {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        fields: type.fields?.map((field) => ({
          name: field.name,
          type: field.type,
          description: field.description,
          deprecated: field.deprecated,
        })),
        description: type.description,
        deprecated: type.deprecated,
      });
    } else {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        unionMembers: type.unionMembers,
        description: type.description,
      });
    }
  }

  const hasQuery = resolversResult.queryFields.fields.length > 0;
  const hasMutation = resolversResult.mutationFields.fields.length > 0;

  if (hasQuery) {
    baseTypes.push({ name: "Query", kind: "Object", fields: [] });
  }
  if (hasMutation) {
    baseTypes.push({ name: "Mutation", kind: "Object", fields: [] });
  }

  const knownTypeNames = new Set([
    ...baseTypes.map((t) => t.name),
    ...inputTypes.map((t) => t.name),
  ]);

  const typeExtensions: TypeExtension[] = [];

  if (hasQuery) {
    typeExtensions.push({
      targetTypeName: "Query",
      fields: resolversResult.queryFields.fields.map(convertToExtensionField),
    });
  }

  if (hasMutation) {
    typeExtensions.push({
      targetTypeName: "Mutation",
      fields: resolversResult.mutationFields.fields.map(
        convertToExtensionField,
      ),
    });
  }

  for (const ext of resolversResult.typeExtensions) {
    if (!knownTypeNames.has(ext.targetTypeName)) {
      const firstField = ext.fields[0];
      diagnostics.push({
        code: "UNKNOWN_TARGET_TYPE",
        message: `Type extension references unknown type '${ext.targetTypeName}'`,
        severity: "error",
        location: firstField
          ? {
              file: firstField.sourceLocation.file,
              line: firstField.sourceLocation.line,
              column: firstField.sourceLocation.column,
            }
          : undefined,
      });
    } else {
      typeExtensions.push(convertResolverTypeExtension(ext));
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");

  return {
    baseTypes,
    inputTypes,
    typeExtensions,
    hasQuery,
    hasMutation,
    hasErrors,
    diagnostics,
  };
}
