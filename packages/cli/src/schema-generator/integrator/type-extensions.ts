/**
 * Builds the type-extension list schema generation emits: the synthesized
 * Query/Mutation/Subscription extensions plus user-defined `extend type`
 * blocks, validating that user-defined extensions target a known type.
 */

import type {
  DeprecationInfo,
  Diagnostic,
  DirectiveInfo,
  GraphQLFieldType,
} from "../../core/index.js";
import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
  TypeExtension,
} from "../../resolver-extractor/index.js";
import type { BaseType, InputType } from "./type-mapper.js";

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

export interface IntegratedTypeExtension {
  readonly targetTypeName: string;
  readonly fields: ReadonlyArray<ExtensionField>;
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
  ext: TypeExtension,
): IntegratedTypeExtension {
  return {
    targetTypeName: ext.targetTypeName,
    fields: ext.fields.map(convertToExtensionField),
  };
}

export interface BuildTypeExtensionsParams {
  readonly hasQuery: boolean;
  readonly hasMutation: boolean;
  readonly hasSubscription: boolean;
  readonly resolversResult: ExtractResolversResult;
  readonly baseTypes: ReadonlyArray<BaseType>;
  readonly inputTypes: ReadonlyArray<InputType>;
}

export interface BuildTypeExtensionsResult {
  readonly typeExtensions: ReadonlyArray<IntegratedTypeExtension>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export function buildTypeExtensions(
  params: BuildTypeExtensionsParams,
): BuildTypeExtensionsResult {
  const {
    hasQuery,
    hasMutation,
    hasSubscription,
    resolversResult,
    baseTypes,
    inputTypes,
  } = params;

  const knownTypeNames = new Set([
    ...baseTypes.map((t) => t.name),
    ...inputTypes.map((t) => t.name),
  ]);

  const typeExtensions: IntegratedTypeExtension[] = [];
  const diagnostics: Diagnostic[] = [];

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

  if (hasSubscription) {
    typeExtensions.push({
      targetTypeName: "Subscription",
      fields: resolversResult.subscriptionFields.fields.map(
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

  return { typeExtensions, diagnostics };
}

export interface InheritInterfaceExtensionFieldsParams {
  readonly typeExtensions: ReadonlyArray<IntegratedTypeExtension>;
  readonly baseTypes: ReadonlyArray<BaseType>;
}

/**
 * Lists the interfaces a type implements, directly or through other
 * interfaces, nearest first.
 */
function collectAncestorInterfaces(
  baseType: BaseType,
  baseTypeMap: ReadonlyMap<string, BaseType>,
): string[] {
  const ancestors: string[] = [];
  // Seeding with the type itself keeps circular interface references (which
  // are reported separately) from looping.
  const visited = new Set<string>([baseType.name]);
  const queue = [...(baseType.implementedInterfaces ?? [])];
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (visited.has(name)) {
      continue;
    }
    visited.add(name);
    ancestors.push(name);
    queue.push(...(baseTypeMap.get(name)?.implementedInterfaces ?? []));
  }
  return ancestors;
}

/**
 * Copies the resolver fields defined on an interface into every type that
 * implements it, directly or transitively.
 *
 * GraphQL requires implementing types to declare every interface field, and
 * resolver maps built with graphql-tools only consult interface field
 * resolvers when `inheritResolversFromInterfaces` is enabled, so each
 * implementing type gets the field and its own resolver map entry.
 *
 * A field the implementing type already declares, as a property or through
 * its own resolver, is not inherited; among interfaces defining the same
 * field, the nearest one wins.
 */
export function inheritInterfaceExtensionFields(
  params: InheritInterfaceExtensionFieldsParams,
): IntegratedTypeExtension[] {
  const { typeExtensions, baseTypes } = params;

  const baseTypeMap = new Map(baseTypes.map((t) => [t.name, t]));
  const extensionMap = new Map(
    typeExtensions.map((ext) => [ext.targetTypeName, ext]),
  );

  const inheritedFieldsMap = new Map<string, ExtensionField[]>();
  for (const baseType of baseTypes) {
    if (baseType.kind !== "Object" && baseType.kind !== "Interface") {
      continue;
    }
    const declaredFieldNames = new Set([
      ...(baseType.fields ?? []).map((f) => f.name),
      ...(extensionMap.get(baseType.name)?.fields ?? []).map((f) => f.name),
    ]);
    const inheritedFields: ExtensionField[] = [];
    for (const interfaceName of collectAncestorInterfaces(
      baseType,
      baseTypeMap,
    )) {
      for (const field of extensionMap.get(interfaceName)?.fields ?? []) {
        if (declaredFieldNames.has(field.name)) {
          continue;
        }
        declaredFieldNames.add(field.name);
        inheritedFields.push(field);
      }
    }
    if (inheritedFields.length > 0) {
      inheritedFieldsMap.set(baseType.name, inheritedFields);
    }
  }

  const result = typeExtensions.map((ext) => {
    const inheritedFields = inheritedFieldsMap.get(ext.targetTypeName);
    return inheritedFields
      ? { ...ext, fields: [...ext.fields, ...inheritedFields] }
      : ext;
  });
  for (const [targetTypeName, fields] of inheritedFieldsMap) {
    if (!extensionMap.has(targetTypeName)) {
      result.push({ targetTypeName, fields });
    }
  }
  return result;
}
