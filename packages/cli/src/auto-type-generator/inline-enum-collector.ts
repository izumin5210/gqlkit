import type ts from "typescript";
import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import { getSourceLocationOrDefault } from "../shared/source-location.js";
import type { DeprecationInfo } from "../shared/tsdoc-parser.js";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
  InlineEnumMemberInfo,
  InlineObjectPropertyDef,
  SourceLocation,
} from "../type-extractor/types/index.js";
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

/**
 * Inline enum with context information for naming and generation.
 */
export interface InlineEnumWithContext {
  readonly members: ReadonlyArray<InlineEnumMemberInfo>;
  readonly context: AutoTypeNameContext;
  readonly sourceLocation: SourceLocation;
  readonly nullable: boolean;
  /** External TypeScript enum symbol for deduplication (null for string literal unions) */
  readonly externalEnumSymbol: ts.Symbol | null;
  /** TSDoc description from the external enum type itself (null for string literal unions) */
  readonly externalEnumDescription: string | null;
  /** @deprecated tag from the external enum type itself (null for string literal unions) */
  readonly externalEnumDeprecated: DeprecationInfo | null;
}

/**
 * Collect inline enums from ExtractedTypeInfo.
 * Task 4.1: Traverse type fields to find inline enums with context.
 */
export function collectInlineEnumsFromTypes(
  extractedTypes: ReadonlyArray<ExtractedTypeInfo>,
): InlineEnumWithContext[] {
  const results: InlineEnumWithContext[] = [];

  for (const typeInfo of extractedTypes) {
    const isInput = isInputTypeName(typeInfo.metadata.name);

    for (const field of typeInfo.fields) {
      collectInlineEnumsFromField(
        field,
        typeInfo.metadata.name,
        [],
        isInput,
        typeInfo.metadata.sourceFile,
        results,
      );
    }
  }

  return results;
}

function collectInlineEnumsFromField(
  field: FieldDefinition,
  parentTypeName: string,
  parentPath: ReadonlyArray<string>,
  isInput: boolean,
  sourceFile: string,
  results: InlineEnumWithContext[],
): void {
  const tsType = field.tsType;
  const fieldPath = [...parentPath, field.name];

  if (tsType.kind === "inlineEnum" && tsType.inlineEnumMembers) {
    results.push({
      members: tsType.inlineEnumMembers,
      context: buildFieldContext(parentTypeName, fieldPath, isInput),
      sourceLocation: getSourceLocationOrDefault(
        field.sourceLocation,
        sourceFile,
      ),
      nullable: tsType.nullable,
      externalEnumSymbol: tsType.externalEnumSymbol,
      externalEnumDescription: tsType.externalEnumDescription,
      externalEnumDeprecated: tsType.externalEnumDeprecated,
    });
  }

  if (
    tsType.kind === "array" &&
    tsType.elementType?.kind === "inlineEnum" &&
    tsType.elementType.inlineEnumMembers
  ) {
    results.push({
      members: tsType.elementType.inlineEnumMembers,
      context: buildFieldContext(parentTypeName, fieldPath, isInput),
      sourceLocation: getSourceLocationOrDefault(
        field.sourceLocation,
        sourceFile,
      ),
      nullable: tsType.elementType.nullable,
      externalEnumSymbol: tsType.elementType.externalEnumSymbol,
      externalEnumDescription: tsType.elementType.externalEnumDescription,
      externalEnumDeprecated: tsType.elementType.externalEnumDeprecated,
    });
  }

  if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
    collectInlineEnumsFromInlineObjectProperties(
      tsType.inlineObjectProperties,
      parentTypeName,
      fieldPath,
      isInput,
      sourceFile,
      results,
    );
  }
}

function collectInlineEnumsFromInlineObjectProperties(
  properties: ReadonlyArray<InlineObjectPropertyDef>,
  parentTypeName: string,
  parentPath: ReadonlyArray<string>,
  isInput: boolean,
  sourceFile: string,
  results: InlineEnumWithContext[],
): void {
  for (const prop of properties) {
    const propPath = [...parentPath, prop.name];
    const tsType = prop.tsType;

    if (tsType.kind === "inlineEnum" && tsType.inlineEnumMembers) {
      results.push({
        members: tsType.inlineEnumMembers,
        context: buildFieldContext(parentTypeName, propPath, isInput),
        sourceLocation: getSourceLocationOrDefault(
          prop.sourceLocation,
          sourceFile,
        ),
        nullable: tsType.nullable,
        externalEnumSymbol: tsType.externalEnumSymbol,
        externalEnumDescription: tsType.externalEnumDescription,
        externalEnumDeprecated: tsType.externalEnumDeprecated,
      });
    }

    if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
      collectInlineEnumsFromInlineObjectProperties(
        tsType.inlineObjectProperties,
        parentTypeName,
        propPath,
        isInput,
        sourceFile,
        results,
      );
    }
  }
}

export interface CollectInlineEnumsFromResolversParams {
  readonly resolversResult: ExtractResolversResult;
}

/**
 * Collect inline enums from ExtractResolversResult.
 * Task 4.2: Traverse resolver args to find inline enums with context.
 */
export function collectInlineEnumsFromResolvers(
  params: CollectInlineEnumsFromResolversParams,
): InlineEnumWithContext[] {
  const { resolversResult } = params;
  const results: InlineEnumWithContext[] = [];

  forEachResolverField(resolversResult, (info) => {
    collectInlineEnumsFromResolverArgs(info, results);
  });

  return results;
}

function collectInlineEnumsFromResolverArgs(
  info: ResolverFieldInfo,
  results: InlineEnumWithContext[],
): void {
  const { field, resolverType, parentTypeName } = info;
  if (!field.args) return;

  for (const arg of field.args) {
    if (arg.inlineEnumMembers) {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType,
        fieldName: field.name,
        argName: arg.name,
        parentTypeName,
        fieldPath: [],
      };

      results.push({
        members: arg.inlineEnumMembers,
        context,
        sourceLocation: field.sourceLocation,
        nullable: arg.type.nullable,
        externalEnumSymbol: arg.externalEnumSymbol,
        externalEnumDescription: arg.externalEnumDescription,
        externalEnumDeprecated: arg.externalEnumDeprecated,
      });
    }

    if (arg.inlineObjectProperties) {
      collectInlineEnumsFromResolverProperties({
        properties: arg.inlineObjectProperties,
        resolverType,
        fieldName: field.name,
        parentTypeName,
        parentPath: [],
        sourceLocation: field.sourceLocation,
        contextKind: "resolverArg",
        argName: arg.name,
        results,
      });
    }
  }
}

interface CollectInlineEnumsFromResolverPropertiesParams {
  readonly properties: ReadonlyArray<InlineObjectPropertyDef>;
  readonly resolverType: ResolverType;
  readonly fieldName: string;
  readonly parentTypeName: string | null;
  readonly parentPath: ReadonlyArray<string>;
  readonly sourceLocation: SourceLocation;
  readonly contextKind: "resolverArg" | "resolverPayload";
  readonly argName?: string;
  readonly results: InlineEnumWithContext[];
}

/**
 * Unified function for collecting inline enums from nested object properties
 * in both resolver args and payload return types.
 */
function collectInlineEnumsFromResolverProperties(
  params: CollectInlineEnumsFromResolverPropertiesParams,
): void {
  const {
    properties,
    resolverType,
    fieldName,
    parentTypeName,
    parentPath,
    sourceLocation,
    contextKind,
    argName,
    results,
  } = params;

  for (const prop of properties) {
    const propPath = [...parentPath, prop.name];
    const tsType = prop.tsType;

    if (tsType.kind === "inlineEnum" && tsType.inlineEnumMembers) {
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
        members: tsType.inlineEnumMembers,
        context,
        sourceLocation: prop.sourceLocation ?? sourceLocation,
        nullable: tsType.nullable,
        externalEnumSymbol: tsType.externalEnumSymbol,
        externalEnumDescription: tsType.externalEnumDescription,
        externalEnumDeprecated: tsType.externalEnumDeprecated,
      });
    }

    if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
      collectInlineEnumsFromResolverProperties({
        ...params,
        properties: tsType.inlineObjectProperties,
        parentPath: propPath,
      });
    }
  }
}

export interface CollectInlineEnumsFromPayloadsParams {
  readonly resolversResult: ExtractResolversResult;
}

/**
 * Collect inline enums from resolver return types (Payload types).
 * Task 3.1: Traverse resolver return types to find inline enums with resolverPayload context.
 */
export function collectInlineEnumsFromPayloads(
  params: CollectInlineEnumsFromPayloadsParams,
): InlineEnumWithContext[] {
  const { resolversResult } = params;
  const results: InlineEnumWithContext[] = [];

  forEachResolverField(resolversResult, (info) => {
    collectInlineEnumsFromPayloadReturnType(info, results);
  });

  return results;
}

function collectInlineEnumsFromPayloadReturnType(
  info: ResolverFieldInfo,
  results: InlineEnumWithContext[],
): void {
  const { field, resolverType, parentTypeName } = info;

  if (field.returnTypeInlineEnumMembers) {
    const context: AutoTypeNameContext = {
      kind: "resolverPayload",
      resolverType,
      fieldName: field.name,
      parentTypeName,
      fieldPath: [],
    };

    results.push({
      members: field.returnTypeInlineEnumMembers,
      context,
      sourceLocation: field.sourceLocation,
      nullable: field.type.nullable,
      externalEnumSymbol: field.returnTypeExternalEnumSymbol,
      externalEnumDescription: field.returnTypeExternalEnumDescription,
      externalEnumDeprecated: field.returnTypeExternalEnumDeprecated,
    });
  }

  if (field.returnTypeInlineObjectProperties) {
    collectInlineEnumsFromResolverProperties({
      properties: field.returnTypeInlineObjectProperties,
      resolverType,
      fieldName: field.name,
      parentTypeName,
      parentPath: [],
      sourceLocation: field.sourceLocation,
      contextKind: "resolverPayload",
      results,
    });
  }
}
