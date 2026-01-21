import type ts from "typescript";
import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
} from "../resolver-extractor/index.js";
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

/**
 * Collect inline enums from ExtractResolversResult.
 * Task 4.2: Traverse resolver args to find inline enums with context.
 */
export function collectInlineEnumsFromResolvers(
  resolversResult: ExtractResolversResult,
): InlineEnumWithContext[] {
  const results: InlineEnumWithContext[] = [];

  for (const field of resolversResult.queryFields.fields) {
    collectInlineEnumsFromResolverArgs(field, "query", null, results);
  }

  for (const field of resolversResult.mutationFields.fields) {
    collectInlineEnumsFromResolverArgs(field, "mutation", null, results);
  }

  for (const ext of resolversResult.typeExtensions) {
    for (const field of ext.fields) {
      collectInlineEnumsFromResolverArgs(
        field,
        "field",
        ext.targetTypeName,
        results,
      );
    }
  }

  return results;
}

function collectInlineEnumsFromResolverArgs(
  field: GraphQLFieldDefinition,
  resolverType: "query" | "mutation" | "field",
  parentTypeName: string | null,
  results: InlineEnumWithContext[],
): void {
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
      collectInlineEnumsFromInlineObjectArg(
        arg.inlineObjectProperties,
        resolverType,
        field.name,
        arg.name,
        parentTypeName,
        [],
        field.sourceLocation,
        results,
      );
    }
  }
}

function collectInlineEnumsFromInlineObjectArg(
  properties: ReadonlyArray<InlineObjectPropertyDef>,
  resolverType: "query" | "mutation" | "field",
  fieldName: string,
  argName: string,
  parentTypeName: string | null,
  parentPath: ReadonlyArray<string>,
  sourceLocation: SourceLocation,
  results: InlineEnumWithContext[],
): void {
  for (const prop of properties) {
    const propPath = [...parentPath, prop.name];
    const tsType = prop.tsType;

    if (tsType.kind === "inlineEnum" && tsType.inlineEnumMembers) {
      const context: AutoTypeNameContext = {
        kind: "resolverArg",
        resolverType,
        fieldName,
        argName,
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
      collectInlineEnumsFromInlineObjectArg(
        tsType.inlineObjectProperties,
        resolverType,
        fieldName,
        argName,
        parentTypeName,
        propPath,
        sourceLocation,
        results,
      );
    }
  }
}
