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
import { extractInlineObjectProperties } from "../../shared/inline-object-extractor.js";
import { isInlineObjectType } from "../../shared/inline-object-utils.js";
import {
  detectScalarMetadata,
  getActualMetadataType,
} from "../../shared/metadata-detector.js";
import { getSourceLocationFromNode } from "../../shared/source-location.js";
import {
  type DeprecationInfo,
  extractTsDocFromSymbol,
  extractTsDocInfo,
} from "../../shared/tsdoc-parser.js";
import {
  getNonNullableTypes,
  isNullableUnion,
} from "../../shared/typescript-utils.js";
import type {
  Diagnostic,
  TSTypeReference,
} from "../../type-extractor/types/index.js";

export type DefineApiResolverType = "query" | "mutation" | "field";

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

export interface ExtractDefineApiResult {
  readonly resolvers: ReadonlyArray<DefineApiResolverInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const RESOLVER_METADATA_PROPERTY = METADATA_PROPERTIES.RESOLVER;

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

function isExported(node: ts.Node): boolean {
  const modifiers = ts.getCombinedModifierFlags(node as ts.Declaration);
  return (modifiers & ts.ModifierFlags.Export) !== 0;
}

/**
 * Checks if a type is an anonymous object type (like inline type literals).
 * Named types and type aliases are not considered anonymous.
 * This is used to determine if an intersection member should trigger
 * treating the whole intersection as an inline object.
 */
function isAnonymousObjectTypeForArgs(type: ts.Type): boolean {
  if (type.aliasSymbol) {
    return false;
  }
  if (!type.symbol) {
    return true;
  }
  const symbolName = type.symbol.getName();
  return symbolName === "__type" || symbolName === "";
}

/**
 * List of TypeScript built-in utility types that should be resolved
 * to their actual properties when used in args.
 */
const BUILTIN_UTILITY_TYPES = [
  "Omit",
  "Pick",
  "Partial",
  "Required",
  "Readonly",
  "Record",
];

/**
 * Checks if a type is a built-in utility type like Omit, Pick, etc.
 */
function isBuiltinUtilityType(type: ts.Type): boolean {
  if (!type.aliasSymbol) {
    return false;
  }
  return BUILTIN_UTILITY_TYPES.includes(type.aliasSymbol.getName());
}

/**
 * Checks if a type is an object-like type (interface, anonymous object, or mapped type).
 * Used to determine if an intersection of object types should be treated as inline.
 */
function isObjectLikeType(type: ts.Type): boolean {
  if (!(type.flags & ts.TypeFlags.Object)) {
    return false;
  }
  const objectType = type as ts.ObjectType;
  return (
    (objectType.objectFlags & ts.ObjectFlags.Interface) !== 0 ||
    (objectType.objectFlags & ts.ObjectFlags.Anonymous) !== 0 ||
    (objectType.objectFlags & ts.ObjectFlags.Mapped) !== 0
  );
}

/**
 * Determines if an intersection type should be treated as an inline object.
 * Returns true when the intersection has anonymous/utility members OR
 * when all members are object-like types that should be merged.
 */
function shouldTreatIntersectionAsInlineForArgs(
  type: ts.IntersectionType,
): boolean {
  // Case 1: Has at least one anonymous/inline/utility type member
  const hasResolvableMember = type.types.some(
    (t) =>
      isInlineObjectType(t) ||
      isAnonymousObjectTypeForArgs(t) ||
      isBuiltinUtilityType(t),
  );
  if (hasResolvableMember) {
    return true;
  }

  // Case 2: All members are object-like types (e.g., ContactInfo & AddressInfo)
  // These should be merged into an inline object
  const allObjectLike = type.types.every((t) => isObjectLikeType(t));
  if (allObjectLike) {
    return true;
  }

  return false;
}

function convertTsTypeToReference(
  type: ts.Type,
  checker: ts.TypeChecker,
  typeNode?: ts.TypeNode,
): TSTypeReference {
  const metadataResult = detectScalarMetadata(type, checker);
  // Skip scalar detection if it's an array of scalars (e.g., Int[])
  // Array types should be handled by the array handling logic below
  if (
    metadataResult.scalarName &&
    !metadataResult.isPrimitive &&
    !metadataResult.isList
  ) {
    return {
      kind: "scalar",
      name: metadataResult.scalarName,
      elementType: null,
      members: null,
      nullable: metadataResult.nullable,
      scalarInfo: {
        scalarName: metadataResult.scalarName,
        typeName: metadataResult.scalarName,
        baseType: undefined,
        isCustom: true,
        only: metadataResult.only,
      },
      inlineObjectProperties: null,
    };
  }

  const typeString = checker.typeToString(type);

  if (type.isUnion()) {
    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol) {
      const name = aliasSymbol.getName();
      return {
        kind: "reference",
        name,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: null,
      };
    }

    const nullable = isNullableUnion(type);
    const nonNullTypes = getNonNullableTypes(type);

    if (nonNullTypes.length === 1 && nonNullTypes[0]) {
      const innerType = convertTsTypeToReference(nonNullTypes[0], checker);
      return { ...innerType, nullable };
    }

    if (nonNullTypes.length > 1) {
      // Check if this is a boolean literal union (true | false)
      const isBooleanLiteralUnion = nonNullTypes.every(
        (t) => t.flags & ts.TypeFlags.BooleanLiteral,
      );
      if (isBooleanLiteralUnion) {
        return {
          kind: "primitive",
          name: "boolean",
          elementType: null,
          members: null,
          nullable,
          scalarInfo: null,
          inlineObjectProperties: null,
        };
      }

      return {
        kind: "union",
        name: null,
        elementType: null,
        members: nonNullTypes.map((t) => convertTsTypeToReference(t, checker)),
        nullable,
        scalarInfo: null,
        inlineObjectProperties: null,
      };
    }
  }

  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    const elementType = typeArgs[0];
    if (elementType) {
      let elementTypeNode: ts.TypeNode | undefined;
      if (typeNode && ts.isArrayTypeNode(typeNode)) {
        elementTypeNode = typeNode.elementType;
      }
      return {
        kind: "array",
        name: null,
        elementType: convertTsTypeToReference(
          elementType,
          checker,
          elementTypeNode,
        ),
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: null,
      };
    }
  }

  if (isInlineObjectType(type)) {
    const inlineProperties = extractInlineObjectProperties(
      type,
      checker,
      convertTsTypeToReference,
    );
    return {
      kind: "inlineObject",
      name: null,
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: inlineProperties,
    };
  }

  // Handle intersection types that should be treated as inline objects
  // This includes intersections with anonymous/utility members OR intersections of
  // named object types (interfaces) that need to be merged
  // BUT only if the type itself is not a named type alias (like User = GqlObject<...>)
  if (type.isIntersection() && !type.aliasSymbol) {
    if (shouldTreatIntersectionAsInlineForArgs(type)) {
      const inlineProperties = extractInlineObjectProperties(
        type,
        checker,
        convertTsTypeToReference,
      );
      return {
        kind: "inlineObject",
        name: null,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: inlineProperties,
      };
    }
  }

  // Check if this is a utility type like Omit, Pick, etc.
  // Utility types have aliasSymbol but their apparent type has resolved properties
  if (type.flags & ts.TypeFlags.Object && isBuiltinUtilityType(type)) {
    const inlineProperties = extractInlineObjectProperties(
      type,
      checker,
      convertTsTypeToReference,
    );
    return {
      kind: "inlineObject",
      name: null,
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: inlineProperties,
    };
  }

  const symbol = type.getSymbol();
  if (symbol) {
    const symbolName = symbol.getName();
    if (!isInternalTypeSymbol(symbolName)) {
      let name = symbolName;
      if (typeNode && ts.isTypeReferenceNode(typeNode)) {
        const typeName = typeNode.typeName;
        if (ts.isIdentifier(typeName)) {
          name = typeName.text;
        } else if (ts.isQualifiedName(typeName)) {
          name = typeName.right.text;
        }
      }
      return {
        kind: "reference",
        name,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: null,
      };
    }
  }

  if (type.flags & ts.TypeFlags.String) {
    return {
      kind: "primitive",
      name: "string",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return {
      kind: "primitive",
      name: "number",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
  }
  if (type.flags & ts.TypeFlags.Boolean) {
    return {
      kind: "primitive",
      name: "boolean",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
  }

  return {
    kind: "reference",
    name: typeString,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: null,
    inlineObjectProperties: null,
  };
}

function getTypeNameFromNode(typeNode: ts.TypeNode): string | undefined {
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;
    if (ts.isIdentifier(typeName)) {
      return typeName.text;
    }
    if (ts.isQualifiedName(typeName)) {
      return typeName.right.text;
    }
  }
  return undefined;
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

/**
 * Extracts property symbols from an args type, handling intersection types
 * and falling back to getApparentType when getProperties() returns empty.
 *
 * This follows the same pattern as extractPropertiesFromType in type-extractor.ts.
 */
function extractArgsPropertySymbols(
  type: ts.Type,
  checker: ts.TypeChecker,
): ts.Symbol[] {
  if (type.isIntersection()) {
    const allProps = new Map<string, ts.Symbol>();
    for (const member of type.types) {
      const memberProps = member.getProperties();
      for (const prop of memberProps) {
        const propName = prop.getName();
        if (!allProps.has(propName)) {
          allProps.set(propName, prop);
        }
      }
    }
    return [...allProps.values()];
  }

  const properties = type.getProperties();
  if (properties.length > 0) {
    return [...properties];
  }

  const apparentType = checker.getApparentType(type);
  if (apparentType !== type) {
    return [...apparentType.getProperties()];
  }

  return [];
}

function extractArgsFromType(
  argsType: ts.Type,
  checker: ts.TypeChecker,
): ArgumentDefinition[] {
  const args: ArgumentDefinition[] = [];
  const properties = extractArgsPropertySymbols(argsType, checker);

  for (const prop of properties) {
    const propType = checker.getTypeOfSymbol(prop);
    const declarations = prop.getDeclarations();
    const declaration = declarations?.[0];

    let optional = false;
    if (declaration && ts.isPropertySignature(declaration)) {
      optional = declaration.questionToken !== undefined;
    }

    const tsdocInfo = extractTSDocFromPropertyWithPriority(prop, checker);

    let defaultValue: DirectiveArgumentValue | null = null;
    let actualPropType = propType;

    if (shouldUnwrapAsGqlField(propType, checker)) {
      const defaultValueResult = detectDefaultValueMetadata(propType, checker);
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }
      actualPropType = unwrapDirectiveType(propType, checker);
    }

    args.push({
      name: prop.getName(),
      tsType: convertTsTypeToReference(actualPropType, checker),
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
  checker: ts.TypeChecker,
  resolverType: DefineApiResolverType,
): TypeArgumentsResult | null {
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

    const argsTypeRef = convertTsTypeToReference(argsType, checker);
    const isNoArgs =
      argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

    const diagnostics: Diagnostic[] = [];

    if (!isNoArgs) {
      diagnostics.push(...validateArgsType(argsType, argsTypeNode, checker));
    }

    const args = isNoArgs ? null : extractArgsFromType(argsType, checker);

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
      returnType: convertTsTypeToReference(returnType, checker, returnTypeNode),
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

  const argsTypeRef = convertTsTypeToReference(argsType, checker);
  const isNoArgs =
    argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

  const diagnostics: Diagnostic[] = [];

  if (!isNoArgs) {
    diagnostics.push(...validateArgsType(argsType, argsTypeNode, checker));
  }

  const args = isNoArgs ? null : extractArgsFromType(argsType, checker);

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
    returnType: convertTsTypeToReference(returnType, checker, returnTypeNode),
    directives,
    diagnostics,
  };
}

function extractExportedInputTypes(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ExportedInputType[] {
  const exportedTypes: ExportedInputType[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && isExported(node)) {
      const name = node.name.getText(sourceFile);
      const type = checker.getTypeAtLocation(node.name);
      const tsType = convertTsTypeToReference(type, checker);

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
): ExtractDefineApiResult {
  const checker = program.getTypeChecker();
  const resolvers: DefineApiResolverInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const filePath of files) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      continue;
    }

    const exportedInputTypes = extractExportedInputTypes(sourceFile, checker);

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
          checker,
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

  return { resolvers, diagnostics };
}
