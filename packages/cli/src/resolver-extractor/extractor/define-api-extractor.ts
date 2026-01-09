import ts from "typescript";
import { isInternalTypeSymbol } from "../../shared/constants.js";
import { detectDefaultValueMetadata } from "../../shared/default-value-detector.js";
import {
  type DirectiveArgumentValue,
  type DirectiveInfo,
  detectDirectiveMetadata,
  extractDirectivesFromType,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "../../shared/directive-detector.js";
import {
  detectScalarMetadata,
  getActualMetadataType,
} from "../../shared/metadata-detector.js";
import {
  type DeprecationInfo,
  extractTSDocFromSymbol,
  extractTSDocInfo,
} from "../../shared/tsdoc-parser.js";
import type {
  Diagnostic,
  InlineObjectPropertyDef,
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

const RESOLVER_METADATA_PROPERTY = " $gqlkitResolver";

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

function isInlineObjectType(type: ts.Type): boolean {
  if (type.aliasSymbol) {
    return false;
  }
  if (!type.symbol) {
    return false;
  }
  const symbolName = type.symbol.getName();
  if (symbolName !== "__type") {
    return false;
  }
  if (!(type.flags & ts.TypeFlags.Object)) {
    return false;
  }
  const objectType = type as ts.ObjectType;
  return (objectType.objectFlags & ts.ObjectFlags.Anonymous) !== 0;
}

function extractInlineObjectProperties(
  type: ts.Type,
  checker: ts.TypeChecker,
): InlineObjectPropertyDef[] {
  const properties: InlineObjectPropertyDef[] = [];
  const typeProperties = type.getProperties();

  for (const prop of typeProperties) {
    const propName = prop.getName();
    if (propName.startsWith(" $")) {
      continue;
    }

    const propType = checker.getTypeOfSymbol(prop);
    const declarations = prop.getDeclarations();
    const declaration = declarations?.[0];

    let optional = false;
    if (declaration && ts.isPropertySignature(declaration)) {
      optional = declaration.questionToken !== undefined;
    }

    const tsdocInfo = extractTSDocFromSymbol(prop, checker);

    let actualPropType = propType;
    let directives: ReadonlyArray<DirectiveInfo> | null = null;
    let directiveNullable = false;
    let defaultValue: DirectiveArgumentValue | null = null;

    if (hasDirectiveMetadata(propType)) {
      const directiveResult = detectDirectiveMetadata(propType, checker);
      if (directiveResult.directives.length > 0) {
        directives = directiveResult.directives;
      }

      const defaultValueResult = detectDefaultValueMetadata(propType, checker);
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }

      if (propType.isUnion()) {
        const hasNull = propType.types.some((t) => t.flags & ts.TypeFlags.Null);
        const hasUndefined = propType.types.some(
          (t) => t.flags & ts.TypeFlags.Undefined,
        );
        if (hasNull || hasUndefined) {
          directiveNullable = true;
        }
      }
      actualPropType = unwrapDirectiveType(propType, checker);

      if (!directiveNullable && actualPropType.isUnion()) {
        const hasNull = actualPropType.types.some(
          (t) => t.flags & ts.TypeFlags.Null,
        );
        const hasUndefined = actualPropType.types.some(
          (t) => t.flags & ts.TypeFlags.Undefined,
        );
        if (hasNull || hasUndefined) {
          directiveNullable = true;
        }
      }
    }

    const tsType = convertTypeToTSTypeReference(actualPropType, checker);
    const finalTsType =
      directiveNullable && !tsType.nullable
        ? { ...tsType, nullable: true }
        : tsType;

    const propSourceLocation = declaration
      ? (() => {
          const declarationSourceFile = declaration.getSourceFile();
          const { line, character } =
            declarationSourceFile.getLineAndCharacterOfPosition(
              declaration.getStart(declarationSourceFile),
            );
          return {
            file: declarationSourceFile.fileName,
            line: line + 1,
            column: character + 1,
          };
        })()
      : null;

    properties.push({
      name: propName,
      tsType: finalTsType,
      optional,
      description: tsdocInfo.description ?? null,
      deprecated: tsdocInfo.deprecated ?? null,
      directives,
      defaultValue,
      sourceLocation: propSourceLocation,
    });
  }

  return properties;
}

function convertTypeToTSTypeReference(
  type: ts.Type,
  checker: ts.TypeChecker,
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

    const types = type.types;
    const hasNull = types.some((t) => (t.flags & ts.TypeFlags.Null) !== 0);
    const hasUndefined = types.some(
      (t) => (t.flags & ts.TypeFlags.Undefined) !== 0,
    );
    const nullable = hasNull || hasUndefined;

    const nonNullTypes = types.filter(
      (t) =>
        (t.flags & ts.TypeFlags.Null) === 0 &&
        (t.flags & ts.TypeFlags.Undefined) === 0,
    );

    if (nonNullTypes.length === 1 && nonNullTypes[0]) {
      const innerType = convertTypeToTSTypeReference(nonNullTypes[0], checker);
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
        members: nonNullTypes.map((t) =>
          convertTypeToTSTypeReference(t, checker),
        ),
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
      return {
        kind: "array",
        name: null,
        elementType: convertTypeToTSTypeReference(elementType, checker),
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: null,
      };
    }
  }

  if (isInlineObjectType(type)) {
    const inlineProperties = extractInlineObjectProperties(type, checker);
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
    const name = symbol.getName();
    if (!isInternalTypeSymbol(name)) {
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
      return extractTSDocFromSymbol(inlineSymbol, checker);
    }
  }

  return extractTSDocFromSymbol(prop, checker);
}

/**
 * Checks if a type should be unwrapped as a GqlFieldDef type.
 * This handles cases where TypeScript represents the type differently
 * when accessed through type references vs. direct declarations.
 */
function shouldUnwrapAsGqlFieldDef(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  // First check using the standard method
  if (hasDirectiveMetadata(type)) {
    return true;
  }

  // Fallback: check if the type string contains GqlFieldDef
  // This handles cases where TypeScript represents the type differently
  const typeString = checker.typeToString(type);
  if (typeString.startsWith("GqlFieldDef<") || typeString === "GqlFieldDef") {
    return true;
  }

  return false;
}

function extractArgsFromType(
  argsType: ts.Type,
  checker: ts.TypeChecker,
): ArgumentDefinition[] {
  const args: ArgumentDefinition[] = [];
  const properties = argsType.getProperties();

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

    if (shouldUnwrapAsGqlFieldDef(propType, checker)) {
      const defaultValueResult = detectDefaultValueMetadata(propType, checker);
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }
      actualPropType = unwrapDirectiveType(propType, checker);
    }

    args.push({
      name: prop.getName(),
      tsType: convertTypeToTSTypeReference(actualPropType, checker),
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

function extractTypeArgumentsFromCall(
  node: ts.CallExpression,
  checker: ts.TypeChecker,
  resolverType: DefineApiResolverType,
): {
  parentTypeName: string | null;
  argsType: TSTypeReference | null;
  args: ArgumentDefinition[] | null;
  returnType: TSTypeReference;
  directives: ReadonlyArray<DirectiveInfo> | null;
} | null {
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

    const argsTypeRef = convertTypeToTSTypeReference(argsType, checker);
    const isNoArgs =
      argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

    const args = isNoArgs ? null : extractArgsFromType(argsType, checker);

    const directives = extractDirectivesFromTypeNode(
      directiveTypeNode,
      checker,
    );

    return {
      parentTypeName: parentTypeName ?? null,
      argsType: isNoArgs ? null : argsTypeRef,
      args: args && args.length > 0 ? args : null,
      returnType: convertTypeToTSTypeReference(returnType, checker),
      directives,
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

  const argsTypeRef = convertTypeToTSTypeReference(argsType, checker);
  const isNoArgs =
    argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

  const args = isNoArgs ? null : extractArgsFromType(argsType, checker);

  const directives = extractDirectivesFromTypeNode(directiveTypeNode, checker);

  return {
    parentTypeName: null,
    argsType: isNoArgs ? null : argsTypeRef,
    args: args && args.length > 0 ? args : null,
    returnType: convertTypeToTSTypeReference(returnType, checker),
    directives,
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
      const tsType = convertTypeToTSTypeReference(type, checker);

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
              const { line, character } =
                sourceFile.getLineAndCharacterOfPosition(
                  declaration.name.getStart(sourceFile),
                );
              diagnostics.push({
                code: "INVALID_DEFINE_CALL",
                message: `Complex expressions with define* functions are not supported. Use a simple 'export const ${fieldName} = defineXxx(...)' pattern.`,
                severity: "error",
                location: {
                  file: filePath,
                  line: line + 1,
                  column: character + 1,
                },
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
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            declaration.name.getStart(sourceFile),
          );
          diagnostics.push({
            code: "INVALID_DEFINE_CALL",
            message: `Failed to extract type arguments from ${funcName ?? "define*"} call for '${fieldName}'`,
            severity: "error",
            location: {
              file: filePath,
              line: line + 1,
              column: character + 1,
            },
          });
          continue;
        }

        const tsdocInfo = extractTSDocInfo(node, checker);

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
