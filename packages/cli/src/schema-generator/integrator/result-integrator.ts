import type { ConstValueNode } from "graphql";
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
  SourceLocation,
} from "../../type-extractor/types/index.js";
import {
  type InputObjectInfo,
  type ValidationContext,
  validateDefaultValue,
} from "../validator/default-value-validator.js";

export interface BaseField {
  readonly name: string;
  readonly type: GraphQLFieldType;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly defaultValue: ConstValueNode | null;
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
            defaultValue: field.defaultValue,
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
            defaultValue: field.defaultValue,
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

  const validationContext = buildValidationContext(
    baseTypes,
    inputTypes,
    customScalarNames,
  );
  validateInputTypeDefaults(
    typesResult,
    inputTypes,
    validationContext,
    diagnostics,
  );
  validateResolverArgDefaults(resolversResult, validationContext, diagnostics);

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

function buildValidationContext(
  baseTypes: ReadonlyArray<BaseType>,
  inputTypes: ReadonlyArray<InputType>,
  customScalarNames: ReadonlyArray<string> | null,
): ValidationContext {
  const knownEnums = new Map<string, ReadonlyArray<string>>();
  for (const type of baseTypes) {
    if (type.kind === "Enum" && type.enumValues) {
      knownEnums.set(
        type.name,
        type.enumValues.map((v) => v.name),
      );
    }
  }

  const knownInputObjects = new Map<string, InputObjectInfo>();
  for (const inputType of inputTypes) {
    knownInputObjects.set(inputType.name, {
      name: inputType.name,
      fields: inputType.fields.map((f) => ({
        name: f.name,
        type: f.type,
      })),
    });
  }

  return {
    knownEnums,
    knownInputObjects,
    customScalars: new Set(customScalarNames ?? []),
  };
}

function validateInputTypeDefaults(
  typesResult: ExtractTypesResult,
  inputTypes: ReadonlyArray<InputType>,
  context: ValidationContext,
  diagnostics: Diagnostic[],
): void {
  const typeSourceFiles = new Map<string, string>();
  for (const type of typesResult.types) {
    typeSourceFiles.set(type.name, type.sourceFile);
  }

  for (const inputType of inputTypes) {
    const sourceFile = typeSourceFiles.get(inputType.name);
    if (!sourceFile) continue;

    for (const field of inputType.fields) {
      if (field.defaultValue) {
        const location: SourceLocation = {
          file: sourceFile,
          line: 1,
          column: 1,
        };
        const result = validateDefaultValue(
          field.type,
          field.defaultValue,
          field.name,
          location,
          context,
        );
        diagnostics.push(...result.diagnostics);
      }
    }
  }
}

function validateResolverArgDefaults(
  resolversResult: ExtractResolversResult,
  context: ValidationContext,
  diagnostics: Diagnostic[],
): void {
  const validateFieldArgs = (field: GraphQLFieldDefinition): void => {
    if (!field.args) return;

    for (const arg of field.args) {
      if (arg.defaultValue) {
        const result = validateDefaultValue(
          arg.type,
          arg.defaultValue,
          arg.name,
          field.sourceLocation,
          context,
        );
        diagnostics.push(...result.diagnostics);
      }
    }
  };

  for (const field of resolversResult.queryFields.fields) {
    validateFieldArgs(field);
  }

  for (const field of resolversResult.mutationFields.fields) {
    validateFieldArgs(field);
  }

  for (const ext of resolversResult.typeExtensions) {
    for (const field of ext.fields) {
      validateFieldArgs(field);
    }
  }
}
