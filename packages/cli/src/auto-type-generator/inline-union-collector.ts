import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import { getSourceLocationOrDefault } from "../shared/source-location.js";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
  InlineObjectPropertyDef,
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import { traverseInlineObjectProperties } from "./inline-object-traverser.js";
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
 * Collect inline unions from ExtractedTypeInfo by traversing type fields.
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
      unionAliasName: tsType.name,
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
      unionAliasName: tsType.elementType.name,
    });
  }

  if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
    traverseInlineObjectProperties(
      { properties: tsType.inlineObjectProperties, parentPath: fieldPath },
      (prop, propPath) => {
        const propTsType = prop.tsType;
        if (propTsType.kind === "union" && propTsType.members) {
          const members = propTsType.members.map((m) =>
            createMemberInfo(m, knownTypeNames),
          );

          results.push({
            members,
            context: buildFieldContext(parentTypeName, propPath, isInput),
            sourceLocation: getSourceLocationOrDefault(
              prop.sourceLocation,
              sourceFile,
            ),
            nullable: propTsType.nullable,
            isInputContext: isInput,
            unionAliasName: propTsType.name,
          });
        }
      },
    );
  }
}

export interface CollectInlineUnionsFromResolversParams {
  readonly resolversResult: ExtractResolversResult;
  readonly knownTypeNames: ReadonlySet<string>;
}

/**
 * Collect inline unions from ExtractResolversResult by traversing resolver args.
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
        unionAliasName: null,
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

interface CollectInlineUnionsFromResolverPropertiesBaseParams {
  readonly properties: ReadonlyArray<InlineObjectPropertyDef>;
  readonly resolverType: ResolverType;
  readonly fieldName: string;
  readonly parentTypeName: string | null;
  readonly parentPath: ReadonlyArray<string>;
  readonly sourceLocation: SourceLocation;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly results: InlineUnionWithContext[];
}

interface CollectInlineUnionsFromResolverArgPropertiesParams
  extends CollectInlineUnionsFromResolverPropertiesBaseParams {
  readonly contextKind: "resolverArg";
  readonly argName: string;
}

interface CollectInlineUnionsFromResolverPayloadPropertiesParams
  extends CollectInlineUnionsFromResolverPropertiesBaseParams {
  readonly contextKind: "resolverPayload";
}

type CollectInlineUnionsFromResolverPropertiesParams =
  | CollectInlineUnionsFromResolverArgPropertiesParams
  | CollectInlineUnionsFromResolverPayloadPropertiesParams;

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
    results,
  } = params;

  traverseInlineObjectProperties(
    { properties, parentPath },
    (prop, propPath) => {
      const tsType = prop.tsType;

      if (tsType.kind === "union" && tsType.members) {
        const members = tsType.members.map((m: TSTypeReference) =>
          createMemberInfo(m, knownTypeNames),
        );

        const context: AutoTypeNameContext =
          params.contextKind === "resolverArg"
            ? {
                kind: "resolverArg",
                resolverType,
                fieldName,
                argName: params.argName,
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
          isInputContext: params.contextKind === "resolverArg",
          unionAliasName: tsType.name,
        });
      }
    },
  );
}

export interface CollectInlineUnionsFromPayloadsParams {
  readonly resolversResult: ExtractResolversResult;
  readonly knownTypeNames: ReadonlySet<string>;
}

/**
 * Collect inline unions from resolver return types (Payload types).
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
      unionAliasName: null,
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
