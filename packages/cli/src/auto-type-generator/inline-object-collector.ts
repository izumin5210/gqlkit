import type {
  DeprecationInfo,
  PropertyDef,
  SourceLocation,
  TSTypeReference,
} from "../core/index.js";
import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
} from "../resolver-extractor/index.js";
import { getSourceLocationOrDefault } from "../shared/source-location.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";
import { traverseInlineObjectProperties } from "./inline-object-traverser.js";
import {
  type AutoTypeNameContext,
  appendFieldPath,
  isInputTypeName,
} from "./naming-convention.js";
import {
  forEachResolverArg,
  forEachResolverField,
  type ResolverType,
} from "./resolver-field-iterator.js";

/**
 * An inline object type discovered while walking declared-type fields,
 * resolver args, or resolver payloads, paired with the naming context needed
 * to generate (or look up) its GraphQL type name.
 */
export interface InlineObjectWithContext {
  readonly properties: ReadonlyArray<PropertyDef>;
  readonly context: AutoTypeNameContext;
  readonly sourceLocation: SourceLocation;
  readonly nullable: boolean;
  /** TSDoc description from the inline object type alias */
  readonly description: string | null;
  /** Deprecation info from the `@deprecated` TSDoc tag on the inline object type alias */
  readonly deprecated: DeprecationInfo | null;
}

interface InlineObjectTypeInfo {
  readonly properties: ReadonlyArray<PropertyDef>;
  readonly nullable: boolean;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

/**
 * Classifies a `TSTypeReference` (or its array element type) as an inline
 * object, returning the info needed to record it. Shared by every context
 * (declared-type fields, resolver args, resolver payloads) and by nested
 * traversal within each.
 */
function getInlineObjectTypeInfo(
  tsType: TSTypeReference,
): InlineObjectTypeInfo | null {
  if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
    return {
      properties: tsType.inlineObjectProperties,
      nullable: tsType.nullable,
      description: tsType.inlineObjectDescription,
      deprecated: tsType.inlineObjectDeprecated,
    };
  }

  if (
    tsType.kind === "array" &&
    tsType.elementType?.kind === "inlineObject" &&
    tsType.elementType.inlineObjectProperties
  ) {
    return {
      properties: tsType.elementType.inlineObjectProperties,
      nullable: tsType.elementType.nullable,
      description: tsType.elementType.inlineObjectDescription,
      deprecated: tsType.elementType.inlineObjectDeprecated,
    };
  }

  return null;
}

interface BuildTypeFieldContextParams {
  readonly parentTypeName: string;
  readonly isInput: boolean;
  readonly fieldPath: ReadonlyArray<string>;
}

function buildTypeFieldContext(
  params: BuildTypeFieldContextParams,
): AutoTypeNameContext {
  const { parentTypeName, isInput, fieldPath } = params;
  return isInput
    ? { kind: "inputField", parentTypeName, fieldPath }
    : { kind: "objectField", parentTypeName, fieldPath };
}

/**
 * Collect inline objects from `ExtractedTypeInfo` by traversing declared-type
 * fields (including nested inline objects within them).
 */
export function collectInlineObjectsFromTypes(
  extractedTypes: ReadonlyArray<ExtractedTypeInfo>,
): InlineObjectWithContext[] {
  const results: InlineObjectWithContext[] = [];

  for (const typeInfo of extractedTypes) {
    const isInput = isInputTypeName(typeInfo.metadata.name);
    const siblingFieldNames = new Set(
      typeInfo.fields.map((field) => field.name),
    );

    for (const field of typeInfo.fields) {
      collectInlineObjectsFromField({
        field,
        parentTypeName: typeInfo.metadata.name,
        isInput,
        sourceFile: typeInfo.metadata.sourceFile,
        siblingFieldNames,
        results,
      });
    }
  }

  return results;
}

interface CollectInlineObjectsFromFieldParams {
  readonly field: PropertyDef;
  readonly parentTypeName: string;
  readonly isInput: boolean;
  readonly sourceFile: string;
  readonly siblingFieldNames: ReadonlySet<string>;
  readonly results: InlineObjectWithContext[];
}

function collectInlineObjectsFromField(
  params: CollectInlineObjectsFromFieldParams,
): void {
  const {
    field,
    parentTypeName,
    isInput,
    sourceFile,
    siblingFieldNames,
    results,
  } = params;
  const inlineObjectTypeInfo = getInlineObjectTypeInfo(field.tsType);
  if (!inlineObjectTypeInfo) return;

  const fieldPath = appendFieldPath({
    parentPath: [],
    fieldName: field.name,
    singularize: field.tsType.kind === "array",
    siblingFieldNames,
  });
  const sourceLocation = getSourceLocationOrDefault(
    field.sourceLocation,
    sourceFile,
  );

  results.push({
    properties: inlineObjectTypeInfo.properties,
    context: buildTypeFieldContext({ parentTypeName, isInput, fieldPath }),
    sourceLocation,
    nullable: inlineObjectTypeInfo.nullable,
    description: inlineObjectTypeInfo.description,
    deprecated: inlineObjectTypeInfo.deprecated,
  });

  traverseInlineObjectProperties(
    {
      properties: inlineObjectTypeInfo.properties,
      parentPath: fieldPath,
      defaultSourceLocation: sourceLocation,
    },
    ({ prop, propPath, resolvedSourceLocation }) => {
      const nestedInfo = getInlineObjectTypeInfo(prop.tsType);
      if (!nestedInfo) return;
      results.push({
        properties: nestedInfo.properties,
        context: buildTypeFieldContext({
          parentTypeName,
          isInput,
          fieldPath: propPath,
        }),
        sourceLocation: resolvedSourceLocation,
        nullable: nestedInfo.nullable,
        description: nestedInfo.description,
        deprecated: nestedInfo.deprecated,
      });
    },
  );
}

/**
 * Collect inline objects from resolver argument types.
 */
export function collectInlineObjectsFromResolvers(
  resolversResult: ExtractResolversResult,
): InlineObjectWithContext[] {
  const results: InlineObjectWithContext[] = [];

  forEachResolverField(
    resolversResult,
    ({ field, resolverType, parentTypeName }) => {
      forEachResolverArg(field, (arg) => {
        collectInlineObjectsFromResolverArg({
          arg,
          field,
          resolverType,
          parentTypeName,
          results,
        });
      });
    },
  );

  return results;
}

interface CollectInlineObjectsFromResolverArgParams {
  readonly arg: GraphQLInputValue;
  readonly field: GraphQLFieldDefinition;
  readonly resolverType: ResolverType;
  readonly parentTypeName: string | null;
  readonly results: InlineObjectWithContext[];
}

function collectInlineObjectsFromResolverArg(
  params: CollectInlineObjectsFromResolverArgParams,
): void {
  const { arg, field, resolverType, parentTypeName, results } = params;
  if (!arg.tsType.inlineObjectProperties) return;

  results.push({
    properties: arg.tsType.inlineObjectProperties,
    context: {
      kind: "resolverArg",
      resolverType,
      fieldName: field.name,
      argName: arg.name,
      parentTypeName,
      fieldPath: [],
    },
    sourceLocation: field.sourceLocation,
    nullable: arg.type.nullable,
    description: null,
    deprecated: null,
  });

  traverseInlineObjectProperties(
    {
      properties: arg.tsType.inlineObjectProperties,
      parentPath: [],
      defaultSourceLocation: field.sourceLocation,
    },
    ({ prop, propPath, resolvedSourceLocation }) => {
      const nestedInfo = getInlineObjectTypeInfo(prop.tsType);
      if (!nestedInfo) return;
      results.push({
        properties: nestedInfo.properties,
        context: {
          kind: "resolverArg",
          resolverType,
          fieldName: field.name,
          argName: arg.name,
          parentTypeName,
          fieldPath: propPath,
        },
        sourceLocation: resolvedSourceLocation,
        nullable: nestedInfo.nullable,
        description: null,
        deprecated: null,
      });
    },
  );
}

/**
 * Collect inline objects from resolver return types (payloads).
 */
export function collectInlineObjectsFromPayloads(
  resolversResult: ExtractResolversResult,
): InlineObjectWithContext[] {
  const results: InlineObjectWithContext[] = [];

  forEachResolverField(
    resolversResult,
    ({ field, resolverType, parentTypeName }) => {
      collectInlineObjectsFromPayload({
        field,
        resolverType,
        parentTypeName,
        results,
      });
    },
  );

  return results;
}

interface CollectInlineObjectsFromPayloadParams {
  readonly field: GraphQLFieldDefinition;
  readonly resolverType: ResolverType;
  readonly parentTypeName: string | null;
  readonly results: InlineObjectWithContext[];
}

function collectInlineObjectsFromPayload(
  params: CollectInlineObjectsFromPayloadParams,
): void {
  const { field, resolverType, parentTypeName, results } = params;
  if (!field.returnTsType.inlineObjectProperties) return;

  results.push({
    properties: field.returnTsType.inlineObjectProperties,
    context: {
      kind: "resolverPayload",
      resolverType,
      fieldName: field.name,
      parentTypeName,
      fieldPath: [],
    },
    sourceLocation: field.sourceLocation,
    nullable: field.type.nullable,
    description: field.returnTsType.inlineObjectDescription,
    deprecated: field.returnTsType.inlineObjectDeprecated,
  });

  traverseInlineObjectProperties(
    {
      properties: field.returnTsType.inlineObjectProperties,
      parentPath: [],
      defaultSourceLocation: field.sourceLocation,
    },
    ({ prop, propPath, resolvedSourceLocation }) => {
      const nestedInfo = getInlineObjectTypeInfo(prop.tsType);
      if (!nestedInfo) return;
      results.push({
        properties: nestedInfo.properties,
        context: {
          kind: "resolverPayload",
          resolverType,
          fieldName: field.name,
          parentTypeName,
          fieldPath: propPath,
        },
        sourceLocation: resolvedSourceLocation,
        nullable: nestedInfo.nullable,
        description: nestedInfo.description,
        deprecated: nestedInfo.deprecated,
      });
    },
  );
}
