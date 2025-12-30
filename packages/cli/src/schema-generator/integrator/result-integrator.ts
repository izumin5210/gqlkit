import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension as ResolverTypeExtension,
} from "../../resolver-extractor/index.js";
import type { ExtractTypesResult } from "../../type-extractor/index.js";
import type {
  Diagnostic,
  EnumValueInfo,
  GraphQLFieldType,
} from "../../type-extractor/types/index.js";

export interface BaseField {
  readonly name: string;
  readonly type: GraphQLFieldType;
}

export interface BaseType {
  readonly name: string;
  readonly kind: "Object" | "Union" | "Enum";
  readonly fields?: ReadonlyArray<BaseField>;
  readonly unionMembers?: ReadonlyArray<string>;
  readonly enumValues?: ReadonlyArray<EnumValueInfo>;
}

export interface ExtensionField {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly args?: ReadonlyArray<GraphQLInputValue>;
  readonly resolverSourceFile: string;
}

export interface TypeExtension {
  readonly targetTypeName: string;
  readonly fields: ReadonlyArray<ExtensionField>;
}

export interface IntegratedResult {
  readonly baseTypes: ReadonlyArray<BaseType>;
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

  const baseTypes: BaseType[] = typesResult.types.map((type) => {
    if (type.kind === "Enum") {
      return {
        name: type.name,
        kind: type.kind,
        enumValues: type.enumValues,
      };
    }
    if (type.kind === "Object") {
      return {
        name: type.name,
        kind: type.kind,
        fields: type.fields?.map((field) => ({
          name: field.name,
          type: field.type,
        })),
      };
    }
    return {
      name: type.name,
      kind: type.kind,
      unionMembers: type.unionMembers,
    };
  });

  const hasQuery = resolversResult.queryFields.fields.length > 0;
  const hasMutation = resolversResult.mutationFields.fields.length > 0;

  if (hasQuery) {
    baseTypes.push({ name: "Query", kind: "Object", fields: [] });
  }
  if (hasMutation) {
    baseTypes.push({ name: "Mutation", kind: "Object", fields: [] });
  }

  const knownTypeNames = new Set(baseTypes.map((t) => t.name));

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
    typeExtensions,
    hasQuery,
    hasMutation,
    hasErrors,
    diagnostics,
  };
}
