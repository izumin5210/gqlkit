import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import { getSourceLocationOrDefault } from "../shared/source-location.js";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
  InlineObjectPropertyDef,
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import type {
  InlineUnionMemberInfo,
  InlineUnionWithContext,
} from "./inline-union-types.js";
import {
  type AutoTypeNameContext,
  buildFieldContext,
  isInputTypeName,
} from "./naming-convention.js";
import {
  forEachResolverField,
  type ResolverFieldInfo,
  type ResolverType,
} from "./resolver-field-iterator.js";

export type {
  InlineUnionMemberInfo,
  InlineUnionWithContext,
} from "./inline-union-types.js";

function createMemberInfo(
  memberType: TSTypeReference,
  knownTypeNames: ReadonlySet<string>,
): InlineUnionMemberInfo {
  const isKnown =
    memberType.kind === "reference" &&
    memberType.name !== null &&
    knownTypeNames.has(memberType.name);

  return {
    memberType,
    needsAutoGeneration: !isKnown,
  };
}

export interface CollectInlineUnionsFromTypesParams {
  readonly extractedTypes: ReadonlyArray<ExtractedTypeInfo>;
  readonly knownTypeNames: ReadonlySet<string>;
}

/**
 * Collect inline unions from ExtractedTypeInfo.
 * Task 2.1: Traverse type fields to find inline unions with context.
 */
export function collectInlineUnionsFromTypes(
  params: CollectInlineUnionsFromTypesParams,
): InlineUnionWithContext[] {
  const { extractedTypes, knownTypeNames } = params;
  const results: InlineUnionWithContext[] = [];

  for (const typeInfo of extractedTypes) {
    const isInput = isInputTypeName(typeInfo.metadata.name);

    for (const field of typeInfo.fields) {
      collectInlineUnionsFromField({
        field,
        parentTypeName: typeInfo.metadata.name,
        parentPath: [],
        isInput,
        sourceFile: typeInfo.metadata.sourceFile,
        knownTypeNames,
        results,
      });
    }
  }

  return results;
}

interface CollectInlineUnionBaseParams {
  readonly parentTypeName: string;
  readonly parentPath: ReadonlyArray<string>;
  readonly isInput: boolean;
  readonly sourceFile: string;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly results: InlineUnionWithContext[];
}

interface CollectFromFieldParams extends CollectInlineUnionBaseParams {
  readonly field: FieldDefinition;
}

function collectInlineUnionsFromField(params: CollectFromFieldParams): void {
  const {
    field,
    parentTypeName,
    parentPath,
    isInput,
    sourceFile,
    knownTypeNames,
    results,
  } = params;
  const tsType = field.tsType;
  const fieldPath = [...parentPath, field.name];

  if (tsType.kind === "union" && tsType.members) {
    const members = tsType.members.map((m) =>
      createMemberInfo(m, knownTypeNames),
    );

    results.push({
      members,
      context: buildFieldContext(parentTypeName, fieldPath, isInput),
      sourceLocation: getSourceLocationOrDefault(
        field.sourceLocation,
        sourceFile,
      ),
      nullable: tsType.nullable,
      isInputContext: isInput,
    });
  }

  if (
    tsType.kind === "array" &&
    tsType.elementType?.kind === "union" &&
    tsType.elementType.members
  ) {
    const members = tsType.elementType.members.map((m) =>
      createMemberInfo(m, knownTypeNames),
    );

    results.push({
      members,
      context: buildFieldContext(parentTypeName, fieldPath, isInput),
      sourceLocation: getSourceLocationOrDefault(
        field.sourceLocation,
        sourceFile,
      ),
      nullable: tsType.elementType.nullable,
      isInputContext: isInput,
    });
  }

  if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
    collectInlineUnionsFromInlineObjectProperties({
      properties: tsType.inlineObjectProperties,
      parentTypeName,
      parentPath: fieldPath,
      isInput,
      sourceFile,
      knownTypeNames,
      results,
    });
  }
}

interface CollectFromPropertiesParams extends CollectInlineUnionBaseParams {
  readonly properties: ReadonlyArray<InlineObjectPropertyDef>;
}

function collectInlineUnionsFromInlineObjectProperties(
  params: CollectFromPropertiesParams,
): void {
  const {
    properties,
    parentTypeName,
    parentPath,
    isInput,
    sourceFile,
    knownTypeNames,
    results,
  } = params;

  for (const prop of properties) {
    const propPath = [...parentPath, prop.name];
    const tsType = prop.tsType;

    if (tsType.kind === "union" && tsType.members) {
      const members = tsType.members.map((m) =>
        createMemberInfo(m, knownTypeNames),
      );

      results.push({
        members,
        context: buildFieldContext(parentTypeName, propPath, isInput),
        sourceLocation: getSourceLocationOrDefault(
          prop.sourceLocation,
          sourceFile,
        ),
        nullable: tsType.nullable,
        isInputContext: isInput,
      });
    }

    if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
      collectInlineUnionsFromInlineObjectProperties({
        properties: tsType.inlineObjectProperties,
        parentTypeName,
        parentPath: propPath,
        isInput,
        sourceFile,
        knownTypeNames,
        results,
      });
    }
  }
}

export interface CollectInlineUnionsFromResolversParams {
  readonly resolversResult: ExtractResolversResult;
  readonly knownTypeNames: ReadonlySet<string>;
}

/**
 * Collect inline unions from ExtractResolversResult.
 * Task 2.2: Traverse resolver args to find inline unions with context.
 */
export function collectInlineUnionsFromResolvers(
  params: CollectInlineUnionsFromResolversParams,
): InlineUnionWithContext[] {
  const { resolversResult, knownTypeNames } = params;
  const results: InlineUnionWithContext[] = [];

  forEachResolverField(resolversResult, (info) => {
    collectInlineUnionsFromResolverArgs({
      ...info,
      knownTypeNames,
      results,
    });
  });

  return results;
}

interface CollectFromResolverArgsParams extends ResolverFieldInfo {
  readonly knownTypeNames: ReadonlySet<string>;
  readonly results: InlineUnionWithContext[];
}

function collectInlineUnionsFromResolverArgs(
  params: CollectFromResolverArgsParams,
): void {
  const { field, resolverType, parentTypeName, knownTypeNames, results } =
    params;
  if (!field.args) return;

  for (const arg of field.args) {
    if (arg.inlineUnionMembers) {
      const members = arg.inlineUnionMembers.map((m: TSTypeReference) =>
        createMemberInfo(m, knownTypeNames),
      );

      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType,
        fieldName: field.name,
        argName: arg.name,
        parentTypeName,
        fieldPath: [],
      };

      results.push({
        members,
        context,
        sourceLocation: field.sourceLocation,
        nullable: arg.type.nullable,
        isInputContext: true,
      });
    }

    if (arg.inlineObjectProperties) {
      collectInlineUnionsFromResolverProperties({
        properties: arg.inlineObjectProperties,
        resolverType,
        fieldName: field.name,
        parentTypeName,
        parentPath: [],
        sourceLocation: field.sourceLocation,
        knownTypeNames,
        contextKind: "resolverArg",
        argName: arg.name,
        results,
      });
    }
  }
}

interface CollectInlineUnionsFromResolverPropertiesParams {
  readonly properties: ReadonlyArray<InlineObjectPropertyDef>;
  readonly resolverType: ResolverType;
  readonly fieldName: string;
  readonly parentTypeName: string | null;
  readonly parentPath: ReadonlyArray<string>;
  readonly sourceLocation: SourceLocation;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly contextKind: "resolverArg" | "resolverPayload";
  readonly argName?: string;
  readonly results: InlineUnionWithContext[];
}

/**
 * Unified function for collecting inline unions from nested object properties
 * in both resolver args and payload return types.
 */
function collectInlineUnionsFromResolverProperties(
  params: CollectInlineUnionsFromResolverPropertiesParams,
): void {
  const {
    properties,
    resolverType,
    fieldName,
    parentTypeName,
    parentPath,
    sourceLocation,
    knownTypeNames,
    contextKind,
    argName,
    results,
  } = params;

  for (const prop of properties) {
    const propPath = [...parentPath, prop.name];
    const tsType = prop.tsType;

    if (tsType.kind === "union" && tsType.members) {
      const members = tsType.members.map((m: TSTypeReference) =>
        createMemberInfo(m, knownTypeNames),
      );

      const context: AutoTypeNameContext =
        contextKind === "resolverArg"
          ? {
              kind: "resolverArg",
              resolverType,
              fieldName,
              argName: argName!,
              parentTypeName,
              fieldPath: propPath,
            }
          : {
              kind: "resolverPayload",
              resolverType,
              fieldName,
              parentTypeName,
              fieldPath: propPath,
            };

      results.push({
        members,
        context,
        sourceLocation: prop.sourceLocation ?? sourceLocation,
        nullable: tsType.nullable,
        isInputContext: contextKind === "resolverArg",
      });
    }

    if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
      collectInlineUnionsFromResolverProperties({
        ...params,
        properties: tsType.inlineObjectProperties,
        parentPath: propPath,
      });
    }
  }
}

export interface CollectInlineUnionsFromPayloadsParams {
  readonly resolversResult: ExtractResolversResult;
  readonly knownTypeNames: ReadonlySet<string>;
}

/**
 * Collect inline unions from resolver return types (Payload types).
 * Task 3.2: Traverse resolver return types to find inline unions with resolverPayload context.
 */
export function collectInlineUnionsFromPayloads(
  params: CollectInlineUnionsFromPayloadsParams,
): InlineUnionWithContext[] {
  const { resolversResult, knownTypeNames } = params;
  const results: InlineUnionWithContext[] = [];

  forEachResolverField(resolversResult, (info) => {
    collectInlineUnionsFromPayloadReturnType({
      ...info,
      knownTypeNames,
      results,
    });
  });

  return results;
}

interface CollectFromPayloadReturnTypeParams extends ResolverFieldInfo {
  readonly knownTypeNames: ReadonlySet<string>;
  readonly results: InlineUnionWithContext[];
}

function collectInlineUnionsFromPayloadReturnType(
  params: CollectFromPayloadReturnTypeParams,
): void {
  const { field, resolverType, parentTypeName, knownTypeNames, results } =
    params;

  if (field.returnTypeInlineUnionMembers) {
    const members = field.returnTypeInlineUnionMembers.map(
      (m: TSTypeReference) => createMemberInfo(m, knownTypeNames),
    );

    const context: AutoTypeNameContext = {
      kind: "resolverPayload",
      resolverType,
      fieldName: field.name,
      parentTypeName,
      fieldPath: [],
    };

    results.push({
      members,
      context,
      sourceLocation: field.sourceLocation,
      nullable: field.type.nullable,
      isInputContext: false,
    });
  }

  if (field.returnTypeInlineObjectProperties) {
    collectInlineUnionsFromResolverProperties({
      properties: field.returnTypeInlineObjectProperties,
      resolverType,
      fieldName: field.name,
      parentTypeName,
      parentPath: [],
      sourceLocation: field.sourceLocation,
      knownTypeNames,
      contextKind: "resolverPayload",
      results,
    });
  }
}
