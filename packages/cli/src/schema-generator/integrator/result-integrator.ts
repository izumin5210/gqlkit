import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension as ResolverTypeExtension,
} from "../../resolver-extractor/index.js";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";
import type { CollectedScalarType } from "../../type-extractor/collector/scalar-collector.js";
import { mergeDescriptions } from "../../type-extractor/collector/scalar-collector.js";
import type { ExtractTypesResult } from "../../type-extractor/index.js";
import type {
  Diagnostic,
  EnumValueInfo,
  GraphQLFieldType,
} from "../../type-extractor/types/index.js";

export interface BaseField {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface BaseType {
  readonly name: string;
  readonly kind: "Object" | "Union" | "Enum";
  readonly fields: ReadonlyArray<BaseField> | null;
  readonly unionMembers: ReadonlyArray<string> | null;
  readonly enumValues: ReadonlyArray<EnumValueInfo> | null;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly sourceFile: string | null;
}

export interface InputType {
  readonly name: string;
  readonly fields: ReadonlyArray<BaseField>;
  readonly sourceFile: string;
  readonly description: string | null;
  readonly isOneOf: boolean;
}

export interface ExtensionField {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly args: ReadonlyArray<GraphQLInputValue> | null;
  readonly resolverSourceFile: string;
  readonly resolverExportName: string | null;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

export interface TypeExtension {
  readonly targetTypeName: string;
  readonly fields: ReadonlyArray<ExtensionField>;
}

/**
 * Custom scalar information for schema generation.
 */
export interface CustomScalarInfo {
  readonly scalarName: string;
  readonly description: string | null;
}

export interface IntegratedResult {
  readonly baseTypes: ReadonlyArray<BaseType>;
  readonly inputTypes: ReadonlyArray<InputType>;
  readonly typeExtensions: ReadonlyArray<TypeExtension>;
  /** @deprecated Use customScalars instead */
  readonly customScalarNames: ReadonlyArray<string> | null;
  /** Custom scalars with description information */
  readonly customScalars: ReadonlyArray<CustomScalarInfo> | null;
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
  customScalarNames: ReadonlyArray<string> | null,
  collectedScalars?: ReadonlyArray<CollectedScalarType> | null,
): IntegratedResult {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...typesResult.diagnostics.errors);
  diagnostics.push(...typesResult.diagnostics.warnings);
  diagnostics.push(...resolversResult.diagnostics.errors);
  diagnostics.push(...resolversResult.diagnostics.warnings);

  const baseTypes: BaseType[] = [];
  const inputTypes: InputType[] = [];

  for (const type of typesResult.types) {
    if (type.kind === "InputObject" || type.kind === "OneOfInputObject") {
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
        isOneOf: type.kind === "OneOfInputObject",
      });
    } else if (type.kind === "Enum") {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        fields: null,
        unionMembers: null,
        enumValues: type.enumValues,
        description: type.description,
        deprecated: type.deprecated,
        sourceFile: type.sourceFile,
      });
    } else if (type.kind === "Object") {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        fields:
          type.fields?.map((field) => ({
            name: field.name,
            type: field.type,
            description: field.description,
            deprecated: field.deprecated,
          })) ?? null,
        unionMembers: null,
        enumValues: null,
        description: type.description,
        deprecated: type.deprecated,
        sourceFile: type.sourceFile,
      });
    } else {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        fields: null,
        unionMembers: type.unionMembers,
        enumValues: null,
        description: type.description,
        deprecated: null,
        sourceFile: type.sourceFile,
      });
    }
  }

  const hasQuery = resolversResult.queryFields.fields.length > 0;
  const hasMutation = resolversResult.mutationFields.fields.length > 0;

  if (hasQuery) {
    baseTypes.push({
      name: "Query",
      kind: "Object",
      fields: [],
      unionMembers: null,
      enumValues: null,
      description: null,
      deprecated: null,
      sourceFile: null,
    });
  }
  if (hasMutation) {
    baseTypes.push({
      name: "Mutation",
      kind: "Object",
      fields: [],
      unionMembers: null,
      enumValues: null,
      description: null,
      deprecated: null,
      sourceFile: null,
    });
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
          : null,
      });
    } else {
      typeExtensions.push(convertResolverTypeExtension(ext));
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");

  const scalarDescriptionMap = new Map<string, string | null>();
  if (collectedScalars) {
    for (const scalar of collectedScalars) {
      const description = mergeDescriptions(scalar.descriptions);
      scalarDescriptionMap.set(scalar.scalarName, description);
    }
  }

  const customScalars: CustomScalarInfo[] | null =
    customScalarNames && customScalarNames.length > 0
      ? customScalarNames.map((name) => ({
          scalarName: name,
          description: scalarDescriptionMap.get(name) ?? null,
        }))
      : null;

  return {
    baseTypes,
    inputTypes,
    typeExtensions,
    customScalarNames:
      customScalarNames && customScalarNames.length > 0
        ? customScalarNames
        : null,
    customScalars,
    hasQuery,
    hasMutation,
    hasErrors,
    diagnostics,
  };
}
