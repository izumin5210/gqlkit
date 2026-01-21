import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
} from "../resolver-extractor/index.js";
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

export type {
  InlineUnionMemberInfo,
  InlineUnionWithContext,
} from "./inline-union-types.js";

import {
  type AutoTypeNameContext,
  buildFieldContext,
} from "./naming-convention.js";

function isInputTypeName(name: string): boolean {
  return name.endsWith("Input");
}

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

interface CollectFromFieldParams {
  readonly field: FieldDefinition;
  readonly parentTypeName: string;
  readonly parentPath: ReadonlyArray<string>;
  readonly isInput: boolean;
  readonly sourceFile: string;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly results: InlineUnionWithContext[];
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
      sourceLocation: field.sourceLocation ?? {
        file: sourceFile,
        line: 1,
        column: 1,
      },
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
      sourceLocation: field.sourceLocation ?? {
        file: sourceFile,
        line: 1,
        column: 1,
      },
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

interface CollectFromPropertiesParams {
  readonly properties: ReadonlyArray<InlineObjectPropertyDef>;
  readonly parentTypeName: string;
  readonly parentPath: ReadonlyArray<string>;
  readonly isInput: boolean;
  readonly sourceFile: string;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly results: InlineUnionWithContext[];
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
        sourceLocation: prop.sourceLocation ?? {
          file: sourceFile,
          line: 1,
          column: 1,
        },
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

  for (const field of resolversResult.queryFields.fields) {
    collectInlineUnionsFromResolverArgs({
      field,
      resolverType: "query",
      parentTypeName: null,
      knownTypeNames,
      results,
    });
  }

  for (const field of resolversResult.mutationFields.fields) {
    collectInlineUnionsFromResolverArgs({
      field,
      resolverType: "mutation",
      parentTypeName: null,
      knownTypeNames,
      results,
    });
  }

  for (const ext of resolversResult.typeExtensions) {
    for (const field of ext.fields) {
      collectInlineUnionsFromResolverArgs({
        field,
        resolverType: "field",
        parentTypeName: ext.targetTypeName,
        knownTypeNames,
        results,
      });
    }
  }

  return results;
}

interface CollectFromResolverArgsParams {
  readonly field: GraphQLFieldDefinition;
  readonly resolverType: "query" | "mutation" | "field";
  readonly parentTypeName: string | null;
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
    const inlineUnionMembers = (
      arg as GraphQLInputValue & {
        inlineUnionMembers?: ReadonlyArray<TSTypeReference>;
      }
    ).inlineUnionMembers;

    if (inlineUnionMembers) {
      const members = inlineUnionMembers.map((m) =>
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
      collectInlineUnionsFromInlineObjectArg({
        properties: arg.inlineObjectProperties,
        resolverType,
        fieldName: field.name,
        argName: arg.name,
        parentTypeName,
        parentPath: [],
        sourceLocation: field.sourceLocation,
        knownTypeNames,
        results,
      });
    }
  }
}

interface CollectFromInlineObjectArgParams {
  readonly properties: ReadonlyArray<InlineObjectPropertyDef>;
  readonly resolverType: "query" | "mutation" | "field";
  readonly fieldName: string;
  readonly argName: string;
  readonly parentTypeName: string | null;
  readonly parentPath: ReadonlyArray<string>;
  readonly sourceLocation: SourceLocation;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly results: InlineUnionWithContext[];
}

function collectInlineUnionsFromInlineObjectArg(
  params: CollectFromInlineObjectArgParams,
): void {
  const {
    properties,
    resolverType,
    fieldName,
    argName,
    parentTypeName,
    parentPath,
    sourceLocation,
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

      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType,
        fieldName,
        argName,
        parentTypeName,
        fieldPath: propPath,
      };

      results.push({
        members,
        context,
        sourceLocation: prop.sourceLocation ?? sourceLocation,
        nullable: tsType.nullable,
        isInputContext: true,
      });
    }

    if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
      collectInlineUnionsFromInlineObjectArg({
        properties: tsType.inlineObjectProperties,
        resolverType,
        fieldName,
        argName,
        parentTypeName,
        parentPath: propPath,
        sourceLocation,
        knownTypeNames,
        results,
      });
    }
  }
}
