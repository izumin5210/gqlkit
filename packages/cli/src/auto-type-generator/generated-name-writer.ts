/**
 * Back-writing of auto-generated type names into the extraction results:
 * once the per-context name maps are populated, every field, resolver
 * payload, and resolver argument whose TS type is an unresolved inline
 * object/enum/union gets its type name (and TSTypeReference) rewritten to
 * the generated GraphQL name.
 */

import { createReferenceType, type PropertyDef } from "../core/index.js";
import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
} from "../resolver-extractor/index.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";
import {
  type AutoTypeNameContext,
  appendFieldPath,
  buildFieldContext,
  getContextKey,
  isInputTypeName,
} from "./naming-convention.js";
import { resolveGeneratedTypeName } from "./resolve-generated-type-name.js";

export interface UpdateTypeNamesParams {
  readonly generatedTypeNames: Map<string, string>;
  readonly enumTypeNames: Map<string, string>;
  readonly unionTypeNames: Map<string, string>;
}

export function updateExtractedTypes(
  extractedTypes: ReadonlyArray<ExtractedTypeInfo>,
  params: UpdateTypeNamesParams,
): ExtractedTypeInfo[] {
  return extractedTypes.map((typeInfo) => {
    const isInput = isInputTypeName(typeInfo.metadata.name);
    const siblingFieldNames = new Set(
      typeInfo.fields.map((field) => field.name),
    );
    return {
      ...typeInfo,
      fields: typeInfo.fields.map((field) =>
        updateField({
          field,
          params,
          parentTypeName: typeInfo.metadata.name,
          isInput,
          siblingFieldNames,
        }),
      ),
    };
  });
}

interface UpdateFieldParams {
  readonly field: PropertyDef;
  readonly params: UpdateTypeNamesParams;
  readonly parentTypeName: string;
  readonly isInput: boolean;
  readonly siblingFieldNames: ReadonlySet<string>;
}

function updateField(updateFieldParams: UpdateFieldParams): PropertyDef {
  const { field, params, parentTypeName, isInput, siblingFieldNames } =
    updateFieldParams;
  const { generatedTypeNames, enumTypeNames, unionTypeNames } = params;
  const context = buildFieldContext({
    parentTypeName,
    fieldPath: appendFieldPath({
      parentPath: [],
      fieldName: field.name,
      singularize: field.tsType.kind === "array",
      siblingFieldNames,
    }),
    isInput,
  });
  const contextKey = getContextKey(context);

  const resolved = resolveGeneratedTypeName({
    tsType: field.tsType,
    contextKey,
    maps: { generatedTypeNames, enumTypeNames, unionTypeNames },
  });
  if (!resolved) {
    return field;
  }

  if (field.tsType.kind === "array" && field.tsType.elementType) {
    return {
      ...field,
      tsType: {
        ...field.tsType,
        elementType: createReferenceType({
          name: resolved.name,
          nullable: field.tsType.elementType.nullable,
        }),
      },
    };
  }

  return {
    ...field,
    tsType: createReferenceType({
      name: resolved.name,
      nullable: field.tsType.nullable,
    }),
  };
}

export function updateResolversResult(
  resolversResult: ExtractResolversResult,
  params: UpdateTypeNamesParams,
): ExtractResolversResult {
  return {
    ...resolversResult,
    queryFields: {
      fields: resolversResult.queryFields.fields.map((field) =>
        updateResolverField({
          field,
          params,
          resolverType: "query",
          parentTypeName: null,
        }),
      ),
    },
    mutationFields: {
      fields: resolversResult.mutationFields.fields.map((field) =>
        updateResolverField({
          field,
          params,
          resolverType: "mutation",
          parentTypeName: null,
        }),
      ),
    },
    subscriptionFields: {
      fields: resolversResult.subscriptionFields.fields.map((field) =>
        updateResolverField({
          field,
          params,
          resolverType: "subscription",
          parentTypeName: null,
        }),
      ),
    },
    typeExtensions: resolversResult.typeExtensions.map((ext) => ({
      ...ext,
      fields: ext.fields.map((field) =>
        updateResolverField({
          field,
          params,
          resolverType: "field",
          parentTypeName: ext.targetTypeName,
        }),
      ),
    })),
  };
}

interface UpdateResolverFieldParams {
  readonly field: GraphQLFieldDefinition;
  readonly params: UpdateTypeNamesParams;
  readonly resolverType: "query" | "mutation" | "subscription" | "field";
  readonly parentTypeName: string | null;
}

function updateResolverField(
  updateResolverFieldParams: UpdateResolverFieldParams,
): GraphQLFieldDefinition {
  const { field, params, resolverType, parentTypeName } =
    updateResolverFieldParams;
  const { generatedTypeNames, enumTypeNames, unionTypeNames } = params;

  let updatedType = field.type;
  let updatedReturnTsType = field.returnTsType;

  const payloadContext: AutoTypeNameContext = {
    kind: "resolverPayload",
    resolverType,
    fieldName: field.name,
    parentTypeName,
    fieldPath: [],
  };
  const resolvedPayload = resolveGeneratedTypeName({
    tsType: field.returnTsType,
    contextKey: getContextKey(payloadContext),
    maps: { generatedTypeNames, enumTypeNames, unionTypeNames },
  });
  if (resolvedPayload) {
    updatedType = { ...field.type, typeName: resolvedPayload.name };
    updatedReturnTsType = createReferenceType({
      name: resolvedPayload.name,
      nullable: field.returnTsType.nullable,
    });
  }

  if (!field.args) {
    return {
      ...field,
      type: updatedType,
      returnTsType: updatedReturnTsType,
    };
  }

  const updatedArgs = field.args.map((arg) => {
    const context: AutoTypeNameContext = {
      kind: "resolverArg",
      resolverType,
      fieldName: field.name,
      argName: arg.name,
      parentTypeName,
      fieldPath: [],
    };
    const resolved = resolveGeneratedTypeName({
      tsType: arg.tsType,
      contextKey: getContextKey(context),
      maps: { generatedTypeNames, enumTypeNames, unionTypeNames },
    });
    if (!resolved) {
      return arg;
    }

    return {
      ...arg,
      type: { ...arg.type, typeName: resolved.name },
      tsType: createReferenceType({
        name: resolved.name,
        nullable: arg.tsType.nullable,
      }),
    };
  });

  return {
    ...field,
    type: updatedType,
    returnTsType: updatedReturnTsType,
    args: updatedArgs,
  };
}
