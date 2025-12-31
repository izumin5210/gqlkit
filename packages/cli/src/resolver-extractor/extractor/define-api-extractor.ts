import ts from "typescript";
import {
  type DeprecationInfo,
  extractTSDocFromSymbol,
  extractTSDocInfo,
} from "../../shared/tsdoc-parser.js";
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
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface DefineApiResolverInfo {
  readonly fieldName: string;
  readonly resolverType: DefineApiResolverType;
  readonly parentTypeName?: string;
  readonly argsType?: TSTypeReference;
  readonly args?: ReadonlyArray<ArgumentDefinition>;
  readonly returnType: TSTypeReference;
  readonly sourceFile: string;
  readonly exportedInputTypes: ReadonlyArray<ExportedInputType>;
  readonly description?: string;
  readonly deprecated?: DeprecationInfo;
}

export interface ExtractDefineApiResult {
  readonly resolvers: ReadonlyArray<DefineApiResolverInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

function detectResolverFromBrandedType(
  callExpr: ts.CallExpression,
  checker: ts.TypeChecker,
): DefineApiResolverType | undefined {
  const returnType = checker.getTypeAtLocation(callExpr);

  const properties = returnType.getProperties();
  const brandProp = properties.find((p) => {
    const name = p.getName();
    return name.includes("ResolverBrandSymbol");
  });

  if (!brandProp) {
    return undefined;
  }

  const brandType = checker.getTypeOfSymbol(brandProp);
  const kindProp = brandType.getProperty("kind");
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

function convertTypeToTSTypeReference(
  type: ts.Type,
  checker: ts.TypeChecker,
): TSTypeReference {
  const typeString = checker.typeToString(type);

  if (type.isUnion()) {
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
      return {
        kind: "union",
        members: nonNullTypes.map((t) =>
          convertTypeToTSTypeReference(t, checker),
        ),
        nullable,
      };
    }
  }

  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    const elementType = typeArgs[0];
    if (elementType) {
      return {
        kind: "array",
        elementType: convertTypeToTSTypeReference(elementType, checker),
        nullable: false,
      };
    }
  }

  const symbol = type.getSymbol();
  if (symbol) {
    const name = symbol.getName();
    if (name !== "__type" && name !== "Array") {
      return {
        kind: "reference",
        name,
        nullable: false,
      };
    }
  }

  if (type.flags & ts.TypeFlags.String) {
    return { kind: "primitive", name: "string", nullable: false };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return { kind: "primitive", name: "number", nullable: false };
  }
  if (type.flags & ts.TypeFlags.Boolean) {
    return { kind: "primitive", name: "boolean", nullable: false };
  }

  return {
    kind: "reference",
    name: typeString,
    nullable: false,
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
): { description?: string; deprecated?: DeprecationInfo } {
  const declarations = prop.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return {};
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

    args.push({
      name: prop.getName(),
      tsType: convertTypeToTSTypeReference(propType, checker),
      optional,
      description: tsdocInfo.description,
      deprecated: tsdocInfo.deprecated,
    });
  }

  return args;
}

function extractTypeArgumentsFromCall(
  node: ts.CallExpression,
  checker: ts.TypeChecker,
  resolverType: DefineApiResolverType,
): {
  parentTypeName?: string;
  argsType?: TSTypeReference;
  args?: ArgumentDefinition[];
  returnType: TSTypeReference;
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

    if (!parentTypeNode || !argsTypeNode || !returnTypeNode) {
      return null;
    }

    const argsType = checker.getTypeFromTypeNode(argsTypeNode);
    const returnType = checker.getTypeFromTypeNode(returnTypeNode);

    const parentTypeName = getTypeNameFromNode(parentTypeNode);

    const argsTypeRef = convertTypeToTSTypeReference(argsType, checker);
    const isNoArgs =
      argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

    const args = isNoArgs ? undefined : extractArgsFromType(argsType, checker);

    return {
      parentTypeName,
      argsType: isNoArgs ? undefined : argsTypeRef,
      args: args && args.length > 0 ? args : undefined,
      returnType: convertTypeToTSTypeReference(returnType, checker),
    };
  }

  if (typeArgs.length < 2) {
    return null;
  }

  const argsTypeNode = typeArgs[0];
  const returnTypeNode = typeArgs[1];

  if (!argsTypeNode || !returnTypeNode) {
    return null;
  }

  const argsType = checker.getTypeFromTypeNode(argsTypeNode);
  const returnType = checker.getTypeFromTypeNode(returnTypeNode);

  const argsTypeRef = convertTypeToTSTypeReference(argsType, checker);
  const isNoArgs =
    argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

  const args = isNoArgs ? undefined : extractArgsFromType(argsType, checker);

  return {
    argsType: isNoArgs ? undefined : argsTypeRef,
    args: args && args.length > 0 ? args : undefined,
    returnType: convertTypeToTSTypeReference(returnType, checker),
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

        const resolverType = detectResolverFromBrandedType(
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
        });
      }
    });
  }

  return { resolvers, diagnostics };
}
