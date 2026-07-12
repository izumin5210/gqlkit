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
