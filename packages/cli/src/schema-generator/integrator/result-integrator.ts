import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension as ResolverTypeExtension,
} from "../../resolver-extractor/index.js";
import type {
  DirectiveDefinitionInfo,
  DirectiveLocation,
} from "../../shared/directive-definition-extractor.js";
import type {
  DirectiveArgumentValue,
  DirectiveInfo,
} from "../../shared/directive-detector.js";
import {
  detectCircularInterfaceReferences,
  validateInterfaceImplementations,
} from "../../shared/interface-validator.js";
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
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
  readonly defaultValue: DirectiveArgumentValue | null;
}

export interface BaseType {
  readonly name: string;
  readonly kind: "Object" | "Interface" | "Union" | "Enum";
  readonly fields: ReadonlyArray<BaseField> | null;
  readonly unionMembers: ReadonlyArray<string> | null;
  readonly enumValues: ReadonlyArray<EnumValueInfo> | null;
  readonly implementedInterfaces: ReadonlyArray<string> | null;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly sourceFile: string | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
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
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
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
  /** Directive definitions extracted from type aliases */
  readonly directiveDefinitions: ReadonlyArray<DirectiveDefinitionInfo> | null;
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
    directives: field.directives,
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

const UNSUPPORTED_LOCATIONS: ReadonlySet<DirectiveLocation> = new Set([
  "SCHEMA",
  "SCALAR",
  "INTERFACE",
  "UNION",
  "ENUM",
]);

type UsageLocation =
  | "OBJECT"
  | "FIELD_DEFINITION"
  | "INPUT_OBJECT"
  | "INPUT_FIELD_DEFINITION";

interface DirectiveUsageContext {
  readonly directiveName: string;
  readonly usageLocation: UsageLocation;
  readonly targetName: string;
  readonly sourceFile: string;
  readonly line: number;
}

function validateDirectiveUsage(
  context: DirectiveUsageContext,
  directiveDefMap: Map<string, DirectiveDefinitionInfo>,
  diagnostics: Diagnostic[],
): void {
  const { directiveName, usageLocation, targetName, sourceFile, line } =
    context;

  const def = directiveDefMap.get(directiveName);
  if (!def) {
    diagnostics.push({
      code: "UNDEFINED_DIRECTIVE",
      message: `${targetName}: Directive '@${directiveName}' is not defined`,
      severity: "warning",
      location: { file: sourceFile, line, column: 1 },
    });
    return;
  }

  for (const loc of def.locations) {
    if (UNSUPPORTED_LOCATIONS.has(loc)) {
      diagnostics.push({
        code: "UNSUPPORTED_DIRECTIVE_LOCATION",
        message: `${targetName}: Directive '@${directiveName}' uses unsupported location ${loc}`,
        severity: "error",
        location: { file: sourceFile, line, column: 1 },
      });
      return;
    }
  }

  const allowedLocations = getCompatibleLocations(usageLocation);
  const hasValidLocation = def.locations.some((loc) =>
    allowedLocations.includes(loc),
  );

  if (!hasValidLocation) {
    diagnostics.push({
      code: "INVALID_DIRECTIVE_LOCATION",
      message: `${targetName}: Directive '@${directiveName}' cannot be used on ${usageLocation} (allowed: ${def.locations.join(", ")})`,
      severity: "error",
      location: { file: sourceFile, line, column: 1 },
    });
  }
}

function getCompatibleLocations(
  usageLocation: UsageLocation,
): DirectiveLocation[] {
  switch (usageLocation) {
    case "OBJECT":
      return ["OBJECT"];
    case "FIELD_DEFINITION":
      return ["FIELD_DEFINITION"];
    case "INPUT_OBJECT":
      return ["INPUT_OBJECT"];
    case "INPUT_FIELD_DEFINITION":
      return ["INPUT_FIELD_DEFINITION"];
  }
}

export function integrate(
  typesResult: ExtractTypesResult,
  resolversResult: ExtractResolversResult,
  customScalarNames: ReadonlyArray<string> | null,
  collectedScalars?: ReadonlyArray<CollectedScalarType> | null,
  directiveDefinitions?: ReadonlyArray<DirectiveDefinitionInfo> | null,
): IntegratedResult {
  const directiveTypeAliasNames = new Set(
    directiveDefinitions?.map((d) => d.typeAliasName) ?? [],
  );

  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...typesResult.diagnostics.errors);
  diagnostics.push(...typesResult.diagnostics.warnings);
  diagnostics.push(...resolversResult.diagnostics.errors);
  diagnostics.push(...resolversResult.diagnostics.warnings);

  const interfaceValidation = validateInterfaceImplementations(
    typesResult.types,
  );
  diagnostics.push(...interfaceValidation.diagnostics);

  const circularValidation = detectCircularInterfaceReferences(
    typesResult.types,
  );
  diagnostics.push(...circularValidation.diagnostics);

  const baseTypes: BaseType[] = [];
  const inputTypes: InputType[] = [];

  for (const type of typesResult.types) {
    if (directiveTypeAliasNames.has(type.name)) {
      continue;
    }

    if (type.kind === "InputObject" || type.kind === "OneOfInputObject") {
      inputTypes.push({
        name: type.name,
        fields:
          type.fields?.map((field) => ({
            name: field.name,
            type: field.type,
            description: field.description,
            deprecated: field.deprecated,
            directives: field.directives,
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
        implementedInterfaces: null,
        description: type.description,
        deprecated: type.deprecated,
        sourceFile: type.sourceFile,
        directives: type.directives,
      });
    } else if (type.kind === "Interface") {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        fields:
          type.fields?.map((field) => ({
            name: field.name,
            type: field.type,
            description: field.description,
            deprecated: field.deprecated,
            directives: field.directives,
            defaultValue: field.defaultValue,
          })) ?? null,
        unionMembers: null,
        enumValues: null,
        implementedInterfaces: type.implementedInterfaces ?? null,
        description: type.description,
        deprecated: type.deprecated,
        sourceFile: type.sourceFile,
        directives: type.directives,
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
            directives: field.directives,
            defaultValue: field.defaultValue,
          })) ?? null,
        unionMembers: null,
        enumValues: null,
        implementedInterfaces: type.implementedInterfaces ?? null,
        description: type.description,
        deprecated: type.deprecated,
        sourceFile: type.sourceFile,
        directives: type.directives,
      });
    } else {
      baseTypes.push({
        name: type.name,
        kind: type.kind,
        fields: null,
        unionMembers: type.unionMembers,
        enumValues: null,
        implementedInterfaces: null,
        description: type.description,
        deprecated: null,
        sourceFile: type.sourceFile,
        directives: type.directives,
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
      implementedInterfaces: null,
      description: null,
      deprecated: null,
      sourceFile: null,
      directives: null,
    });
  }
  if (hasMutation) {
    baseTypes.push({
      name: "Mutation",
      kind: "Object",
      fields: [],
      unionMembers: null,
      enumValues: null,
      implementedInterfaces: null,
      description: null,
      deprecated: null,
      sourceFile: null,
      directives: null,
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

  const directiveDefMap = new Map<string, DirectiveDefinitionInfo>();
  for (const def of directiveDefinitions ?? []) {
    directiveDefMap.set(def.name, def);
  }

  for (const type of typesResult.types) {
    if (directiveTypeAliasNames.has(type.name)) {
      continue;
    }

    const usageLocation: UsageLocation =
      type.kind === "InputObject" || type.kind === "OneOfInputObject"
        ? "INPUT_OBJECT"
        : "OBJECT";

    if (type.directives) {
      for (const directive of type.directives) {
        validateDirectiveUsage(
          {
            directiveName: directive.name,
            usageLocation,
            targetName: `Type '${type.name}'`,
            sourceFile: type.sourceFile,
            line: 1,
          },
          directiveDefMap,
          diagnostics,
        );
      }
    }

    const fieldUsageLocation: UsageLocation =
      type.kind === "InputObject" || type.kind === "OneOfInputObject"
        ? "INPUT_FIELD_DEFINITION"
        : "FIELD_DEFINITION";

    for (const field of type.fields ?? []) {
      if (field.directives) {
        for (const directive of field.directives) {
          validateDirectiveUsage(
            {
              directiveName: directive.name,
              usageLocation: fieldUsageLocation,
              targetName: `Field '${type.name}.${field.name}'`,
              sourceFile: type.sourceFile,
              line: 1,
            },
            directiveDefMap,
            diagnostics,
          );
        }
      }
    }
  }

  for (const ext of typeExtensions) {
    for (const field of ext.fields) {
      if (field.directives) {
        for (const directive of field.directives) {
          validateDirectiveUsage(
            {
              directiveName: directive.name,
              usageLocation: "FIELD_DEFINITION",
              targetName: `Field '${ext.targetTypeName}.${field.name}'`,
              sourceFile: field.resolverSourceFile,
              line: 1,
            },
            directiveDefMap,
            diagnostics,
          );
        }
      }
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
    directiveDefinitions:
      directiveDefinitions && directiveDefinitions.length > 0
        ? directiveDefinitions
        : null,
    hasQuery,
    hasMutation,
    hasErrors,
    diagnostics,
  };
}
