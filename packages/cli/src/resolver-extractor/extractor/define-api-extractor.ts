import ts from "typescript";
import {
  isInternalTypeSymbol,
  METADATA_PROPERTIES,
  RUNTIME_TYPE_NAMES,
} from "../../shared/constants.js";
import { detectDefaultValueMetadata } from "../../shared/default-value-detector.js";
import {
  type DirectiveArgumentValue,
  type DirectiveInfo,
  extractDirectivesFromType,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "../../shared/directive-detector.js";
import { getActualMetadataType } from "../../shared/metadata-detector.js";
import { getSourceLocationFromNode } from "../../shared/source-location.js";
import {
  type DeprecationInfo,
  extractTsDocFromSymbol,
  extractTsDocInfo,
} from "../../shared/tsdoc-parser.js";
import {
  extractPropertySymbols,
  getTypeNameFromNode,
  hasUndefinedInType,
  isExported,
} from "../../shared/typescript-utils.js";
import {
  type FieldTypeResolverContext,
  resolveFieldType,
} from "../../type-extractor/extractor/field-type-resolver.js";
import type { GlobalTypeMapping } from "../../type-extractor/extractor/type-extractor.js";
import type {
  Diagnostic,
  TSTypeReference,
} from "../../type-extractor/types/index.js";

export type DefineApiResolverType = "query" | "mutation" | "field";

export type AbstractResolverKind = "resolveType" | "isTypeOf";

export interface ExportedInputType {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly sourceFile: string;
}

export interface ArgumentDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly defaultValue: DirectiveArgumentValue | null;
}

export interface DefineApiResolverInfo {
  readonly fieldName: string;
  readonly resolverType: DefineApiResolverType;
  readonly parentTypeName: string | null;
  readonly argsType: TSTypeReference | null;
  readonly args: ReadonlyArray<ArgumentDefinition> | null;
  readonly returnType: TSTypeReference;
  readonly sourceFile: string;
  readonly exportedInputTypes: ReadonlyArray<ExportedInputType>;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
}

export interface AbstractResolverInfo {
  readonly kind: AbstractResolverKind;
  readonly targetTypeName: string;
  readonly exportName: string;
  readonly sourceFile: string;
  readonly sourceLocation: {
    readonly file: string;
    readonly line: number;
    readonly column: number;
  };
}

export interface ExtractDefineApiResult {
  readonly resolvers: ReadonlyArray<DefineApiResolverInfo>;
  readonly abstractTypeResolvers: ReadonlyArray<AbstractResolverInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export interface ExtractDefineApiOptions {
  readonly knownTypeNames?: ReadonlySet<string>;
  readonly globalTypeMappings?: ReadonlyArray<GlobalTypeMapping>;
}

const RESOLVER_METADATA_PROPERTY = METADATA_PROPERTIES.RESOLVER;
const ABSTRACT_RESOLVER_METADATA_PROPERTY =
  METADATA_PROPERTIES.ABSTRACT_RESOLVER;

/**
 * Detects abstract resolver kind and target type from metadata embedded in the type.
 * Returns null if no abstract resolver metadata is found.
 */
function detectAbstractResolverFromMetadataType(
  callExpr: ts.CallExpression,
  checker: ts.TypeChecker,
): { kind: AbstractResolverKind; targetTypeName: string } | null {
  const returnType = checker.getTypeAtLocation(callExpr);

  const metadataProp = returnType.getProperty(
    ABSTRACT_RESOLVER_METADATA_PROPERTY,
  );
  if (!metadataProp) {
    return null;
  }

  const metadataType = checker.getTypeOfSymbol(metadataProp);
  const actualType = getActualMetadataType(metadataType);
  if (!actualType) {
    return null;
  }

  const kindProp = actualType.getProperty("kind");
  if (!kindProp) {
    return null;
  }

  const kindType = checker.getTypeOfSymbol(kindProp);
  if (!kindType.isStringLiteral()) {
    return null;
  }

  const kind = kindType.value;
  if (kind !== "resolveType" && kind !== "isTypeOf") {
    return null;
  }

  const targetTypeProp = actualType.getProperty("targetType");
  if (!targetTypeProp) {
    return null;
  }

  const targetType = checker.getTypeOfSymbol(targetTypeProp);
  const targetTypeName = extractTypeNameFromType(targetType, checker);

  if (!targetTypeName) {
    return null;
  }

  return { kind, targetTypeName };
}

/**
 * Extracts a type name from a TypeScript type.
 * Handles internal type symbols (like __type) by falling back to typeToString.
 * Returns null for unresolvable types (any, unknown).
 */
function extractTypeNameFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): string | null {
  if (type.flags & ts.TypeFlags.Any) {
    return null;
  }

  if (type.aliasSymbol) {
    const aliasName = type.aliasSymbol.getName();
    if (!isInternalTypeSymbol(aliasName)) {
      return aliasName;
    }
  }

  const symbol = type.getSymbol();
  if (symbol) {
    const symbolName = symbol.getName();
    if (!isInternalTypeSymbol(symbolName)) {
      return symbolName;
    }
  }

  const typeString = checker.typeToString(type);
  if (typeString && typeString !== "unknown" && typeString !== "any") {
    return typeString;
  }

  return null;
}

/**
 * Detects resolver type from metadata embedded in the type.
 * Follows the same pattern as scalar metadata detection.
 */
function detectResolverFromMetadataType(
  callExpr: ts.CallExpression,
  checker: ts.TypeChecker,
): DefineApiResolverType | undefined {
  const returnType = checker.getTypeAtLocation(callExpr);

  const metadataProp = returnType.getProperty(RESOLVER_METADATA_PROPERTY);
  if (!metadataProp) {
    return undefined;
  }

  const metadataType = checker.getTypeOfSymbol(metadataProp);
  const actualType = getActualMetadataType(metadataType);
  if (!actualType) {
    return undefined;
  }

  const kindProp = actualType.getProperty("kind");
  if (!kindProp) {
    return undefined;
  }

  const kindType = checker.getTypeOfSymbol(kindProp);
  if (kindType.isStringLiteral()) {
    const kind = kindType.value;
    if (kind === "query" || kind === "mutation" || kind === "field") {
      return kind;
    }
  }

  return undefined;
}

/**
 * Wrapper function that delegates to resolveFieldType.
 * This maintains the existing call signature while using the new implementation.
 */
function convertTsTypeToReference(
  type: ts.Type,
  ctx: FieldTypeResolverContext,
  typeNode?: ts.TypeNode,
): TSTypeReference {
  return resolveFieldType(type, typeNode, ctx);
}

function isInlineTypeLiteralDeclaration(declaration: ts.Declaration): boolean {
  if (!ts.isPropertySignature(declaration)) {
    return false;
  }

  const parent = declaration.parent;
  if (!ts.isTypeLiteralNode(parent)) {
    return false;
  }

  const grandparent = parent.parent;
  if (ts.isTypeAliasDeclaration(grandparent)) {
    return false;
  }
  if (ts.isInterfaceDeclaration(grandparent)) {
    return false;
  }

  return true;
}

function extractTSDocFromPropertyWithPriority(
  prop: ts.Symbol,
  checker: ts.TypeChecker,
): { description: string | null; deprecated: DeprecationInfo | null } {
  const declarations = prop.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return { description: null, deprecated: null };
  }

  const inlineDeclaration = declarations.find(isInlineTypeLiteralDeclaration);

  if (inlineDeclaration) {
    const inlineSymbol = checker.getSymbolAtLocation(
      (inlineDeclaration as ts.PropertySignature).name,
    );
    if (inlineSymbol) {
      return extractTsDocFromSymbol(inlineSymbol, checker);
    }
  }

  return extractTsDocFromSymbol(prop, checker);
}

/**
 * Checks if a type should be unwrapped as a GqlField type.
 * This handles cases where TypeScript represents the type differently
 * when accessed through type references vs. direct declarations.
 */
function shouldUnwrapAsGqlField(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  // First check using the standard method
  if (hasDirectiveMetadata(type)) {
    return true;
  }

  // Fallback: check if the type string contains GqlField
  // This handles cases where TypeScript represents the type differently
  const typeString = checker.typeToString(type);
  if (
    typeString.startsWith(`${RUNTIME_TYPE_NAMES.GQL_FIELD}<`) ||
    typeString === RUNTIME_TYPE_NAMES.GQL_FIELD
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a type is the NoArgs type (Record<string, never>).
 * This is a special type that represents "no arguments".
 */
function isNoArgsType(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (type.aliasSymbol?.getName() === "NoArgs") {
    return true;
  }
  if (type.aliasSymbol?.getName() === "Record") {
    return true;
  }
  const typeStr = checker.typeToString(type);
  if (typeStr === "Record<string, never>") {
    return true;
  }
  return false;
}

/**
 * Checks if a type has only index signatures with no named properties.
 * Types like `{ [key: string]: number }` return true.
 * Does NOT return true for NoArgs type.
 */
function hasOnlyIndexSignatures(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  if (isNoArgsType(type, checker)) {
    return false;
  }

  const targetType = checker.getApparentType(type);

  const indexInfos = checker.getIndexInfosOfType(targetType);
  const hasIndexSignatures = indexInfos.length > 0;

  if (!hasIndexSignatures) {
    return false;
  }

  const properties = targetType
    .getProperties()
    .filter((p) => !p.getName().startsWith(" $"));
  if (properties.length > 0) {
    return false;
  }

  return true;
}

/**
 * Gets the type name for error messages.
 */
function getTypeNameForDiagnostic(
  type: ts.Type,
  checker: ts.TypeChecker,
): string {
  if (type.aliasSymbol) {
    return type.aliasSymbol.getName();
  }
  if (type.symbol) {
    return type.symbol.getName();
  }
  return checker.typeToString(type);
}

function extractArgsFromType(
  argsType: ts.Type,
  ctx: FieldTypeResolverContext,
  argsTypeNode?: ts.TypeNode,
): ArgumentDefinition[] {
  const args: ArgumentDefinition[] = [];
  const properties = extractPropertySymbols(argsType, ctx.checker);

  const memberTypeNodes = new Map<string, ts.TypeNode>();
  if (argsTypeNode && ts.isTypeLiteralNode(argsTypeNode)) {
    for (const member of argsTypeNode.members) {
      if (ts.isPropertySignature(member) && member.name && member.type) {
        const name = ts.isIdentifier(member.name)
          ? member.name.text
          : member.name.getText();
        memberTypeNodes.set(name, member.type);
      }
    }
  }

  for (const prop of properties) {
    const propType = ctx.checker.getTypeOfSymbol(prop);
    const optional = hasUndefinedInType(propType);

    const tsdocInfo = extractTSDocFromPropertyWithPriority(prop, ctx.checker);

    let defaultValue: DirectiveArgumentValue | null = null;
    let actualPropType = propType;

    if (shouldUnwrapAsGqlField(propType, ctx.checker)) {
      const defaultValueResult = detectDefaultValueMetadata(
        propType,
        ctx.checker,
      );
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }
      actualPropType = unwrapDirectiveType(propType, ctx.checker);
    }

    const propTypeNode = memberTypeNodes.get(prop.getName());
    args.push({
      name: prop.getName(),
      tsType: convertTsTypeToReference(actualPropType, ctx, propTypeNode),
      optional,
      description: tsdocInfo.description,
      deprecated: tsdocInfo.deprecated,
      defaultValue,
    });
  }

  return args;
}

function extractDirectivesFromTypeNode(
  typeNode: ts.TypeNode | undefined,
  checker: ts.TypeChecker,
): ReadonlyArray<DirectiveInfo> | null {
  if (!typeNode) {
    return null;
  }

  const type = checker.getTypeFromTypeNode(typeNode);
  const directiveResult = extractDirectivesFromType(type, checker);

  if (directiveResult.directives.length > 0) {
    return directiveResult.directives;
  }

  return null;
}

interface TypeArgumentsResult {
  parentTypeName: string | null;
  argsType: TSTypeReference | null;
  args: ArgumentDefinition[] | null;
  returnType: TSTypeReference;
  directives: ReadonlyArray<DirectiveInfo> | null;
  diagnostics: Diagnostic[];
}

/**
 * Validates an args type and returns diagnostics for problematic types.
 */
function validateArgsType(
  argsType: ts.Type,
  argsTypeNode: ts.TypeNode,
  checker: ts.TypeChecker,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (hasOnlyIndexSignatures(argsType, checker)) {
    const typeName = getTypeNameForDiagnostic(argsType, checker);
    diagnostics.push({
      code: "INDEX_SIGNATURE_ONLY",
      message: `Type '${typeName}' contains only index signatures and cannot be represented as a GraphQL type. Use a concrete object type instead.`,
      severity: "error",
      location: getSourceLocationFromNode(argsTypeNode),
    });
  }

  return diagnostics;
}

/**
 * Checks if the extracted args are empty and the original type was not NoArgs.
 * This indicates the type resolved to an empty object.
 * Does not emit warnings for types that only have index signatures (they get INDEX_SIGNATURE_ONLY error instead).
 */
function checkEmptyArgsType(
  argsType: ts.Type,
  argsTypeNode: ts.TypeNode,
  args: ArgumentDefinition[] | null,
  checker: ts.TypeChecker,
): Diagnostic | null {
  if (isNoArgsType(argsType, checker)) {
    return null;
  }

  if (hasOnlyIndexSignatures(argsType, checker)) {
    return null;
  }

  if (args !== null && args.length === 0) {
    const typeName = getTypeNameForDiagnostic(argsType, checker);
    return {
      code: "EMPTY_TYPE_PROPERTIES",
      message: `Type '${typeName}' has no properties. Consider adding properties or using a different type.`,
      severity: "warning",
      location: getSourceLocationFromNode(argsTypeNode),
    };
  }
  return null;
}

function extractTypeArgumentsFromCall(
  node: ts.CallExpression,
  ctx: FieldTypeResolverContext,
  resolverType: DefineApiResolverType,
): TypeArgumentsResult | null {
  const { checker } = ctx;
  const typeArgs = node.typeArguments;
  if (!typeArgs) {
    return null;
  }

  if (resolverType === "field") {
    if (typeArgs.length < 3) {
      return null;
    }
    const parentTypeNode = typeArgs[0];
    const argsTypeNode = typeArgs[1];
    const returnTypeNode = typeArgs[2];
    const directiveTypeNode = typeArgs[3];

    if (!parentTypeNode || !argsTypeNode || !returnTypeNode) {
      return null;
    }

    const argsType = checker.getTypeFromTypeNode(argsTypeNode);
    const returnType = checker.getTypeFromTypeNode(returnTypeNode);

    const parentTypeName = getTypeNameFromNode(parentTypeNode);

    const argsTypeRef = convertTsTypeToReference(argsType, ctx);
    const isNoArgs =
      argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

    const diagnostics: Diagnostic[] = [];

    if (!isNoArgs) {
      diagnostics.push(...validateArgsType(argsType, argsTypeNode, checker));
    }

    const args = isNoArgs
      ? null
      : extractArgsFromType(argsType, ctx, argsTypeNode);

    if (!isNoArgs) {
      const emptyDiagnostic = checkEmptyArgsType(
        argsType,
        argsTypeNode,
        args,
        checker,
      );
      if (emptyDiagnostic) {
        diagnostics.push(emptyDiagnostic);
      }
    }

    const directives = extractDirectivesFromTypeNode(
      directiveTypeNode,
      checker,
    );

    return {
      parentTypeName: parentTypeName ?? null,
      argsType: isNoArgs ? null : argsTypeRef,
      args: args && args.length > 0 ? args : null,
      returnType: convertTsTypeToReference(returnType, ctx, returnTypeNode),
      directives,
      diagnostics,
    };
  }

  if (typeArgs.length < 2) {
    return null;
  }

  const argsTypeNode = typeArgs[0];
  const returnTypeNode = typeArgs[1];
  const directiveTypeNode = typeArgs[2];

  if (!argsTypeNode || !returnTypeNode) {
    return null;
  }

  const argsType = checker.getTypeFromTypeNode(argsTypeNode);
  const returnType = checker.getTypeFromTypeNode(returnTypeNode);

  const argsTypeRef = convertTsTypeToReference(argsType, ctx);
  const isNoArgs =
    argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

  const diagnostics: Diagnostic[] = [];

  if (!isNoArgs) {
    diagnostics.push(...validateArgsType(argsType, argsTypeNode, checker));
  }

  const args = isNoArgs
    ? null
    : extractArgsFromType(argsType, ctx, argsTypeNode);

  if (!isNoArgs) {
    const emptyDiagnostic = checkEmptyArgsType(
      argsType,
      argsTypeNode,
      args,
      checker,
    );
    if (emptyDiagnostic) {
      diagnostics.push(emptyDiagnostic);
    }
  }

  const directives = extractDirectivesFromTypeNode(directiveTypeNode, checker);

  return {
    parentTypeName: null,
    argsType: isNoArgs ? null : argsTypeRef,
    args: args && args.length > 0 ? args : null,
    returnType: convertTsTypeToReference(returnType, ctx, returnTypeNode),
    directives,
    diagnostics,
  };
}

function extractExportedInputTypes(
  sourceFile: ts.SourceFile,
  ctx: FieldTypeResolverContext,
): ExportedInputType[] {
  const exportedTypes: ExportedInputType[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && isExported(node)) {
      const name = node.name.getText(sourceFile);
      const type = ctx.checker.getTypeAtLocation(node.name);
      const tsType = convertTsTypeToReference(type, ctx);

      exportedTypes.push({
        name,
        tsType,
        sourceFile: sourceFile.fileName,
      });
    }
  });

  return exportedTypes;
}

export function extractDefineApiResolvers(
  program: ts.Program,
  files: ReadonlyArray<string>,
  options: ExtractDefineApiOptions = {},
): ExtractDefineApiResult {
  const checker = program.getTypeChecker();
  const resolvers: DefineApiResolverInfo[] = [];
  const abstractTypeResolvers: AbstractResolverInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  const fieldTypeResolverContext: FieldTypeResolverContext = {
    checker,
    knownTypeNames: options.knownTypeNames ?? new Set(),
    globalTypeMappings: options.globalTypeMappings ?? [],
  };

  for (const filePath of files) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      continue;
    }

    const exportedInputTypes = extractExportedInputTypes(
      sourceFile,
      fieldTypeResolverContext,
    );

    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isVariableStatement(node)) {
        return;
      }

      if (!isExported(node)) {
        return;
      }

      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }

        const fieldName = declaration.name.getText(sourceFile);
        const initializer = declaration.initializer;

        if (!initializer) {
          continue;
        }

        if (!ts.isCallExpression(initializer)) {
          if (
            ts.isConditionalExpression(initializer) ||
            ts.isBinaryExpression(initializer)
          ) {
            const hasDefineCall = initializer
              .getText(sourceFile)
              .match(/define(Query|Mutation|Field)/);
            if (hasDefineCall) {
              diagnostics.push({
                code: "INVALID_DEFINE_CALL",
                message: `Complex expressions with define* functions are not supported. Use a simple 'export const ${fieldName} = defineXxx(...)' pattern.`,
                severity: "error",
                location: getSourceLocationFromNode(declaration.name),
              });
            }
          }
          continue;
        }

        const abstractResolverInfo = detectAbstractResolverFromMetadataType(
          initializer,
          checker,
        );

        if (abstractResolverInfo) {
          const sourceLocation = getSourceLocationFromNode(declaration.name);
          if (sourceLocation) {
            abstractTypeResolvers.push({
              kind: abstractResolverInfo.kind,
              targetTypeName: abstractResolverInfo.targetTypeName,
              exportName: fieldName,
              sourceFile: filePath,
              sourceLocation,
            });
          }
          continue;
        }

        const resolverType = detectResolverFromMetadataType(
          initializer,
          checker,
        );

        if (!resolverType) {
          continue;
        }

        const funcName = ts.isIdentifier(initializer.expression)
          ? initializer.expression.text
          : undefined;

        const typeInfo = extractTypeArgumentsFromCall(
          initializer,
          fieldTypeResolverContext,
          resolverType,
        );

        if (!typeInfo) {
          diagnostics.push({
            code: "INVALID_DEFINE_CALL",
            message: `Failed to extract type arguments from ${funcName ?? "define*"} call for '${fieldName}'`,
            severity: "error",
            location: getSourceLocationFromNode(declaration.name),
          });
          continue;
        }

        diagnostics.push(...typeInfo.diagnostics);

        const tsdocInfo = extractTsDocInfo(node, checker);

        resolvers.push({
          fieldName,
          resolverType,
          parentTypeName: typeInfo.parentTypeName,
          argsType: typeInfo.argsType,
          args: typeInfo.args,
          returnType: typeInfo.returnType,
          sourceFile: filePath,
          exportedInputTypes,
          description: tsdocInfo.description,
          deprecated: tsdocInfo.deprecated,
          directives: typeInfo.directives,
        });
      }
    });
  }

  return { resolvers, abstractTypeResolvers, diagnostics };
}
