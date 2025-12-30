import ts from "typescript";
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
}

export interface ExtractDefineApiResult {
  readonly resolvers: ReadonlyArray<DefineApiResolverInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const DEFINE_API_FUNCTIONS = new Set([
  "defineQuery",
  "defineMutation",
  "defineField",
]);

const RUNTIME_PACKAGE = "@gqlkit-ts/runtime";

function isExported(node: ts.Node): boolean {
  const modifiers = ts.getCombinedModifierFlags(node as ts.Declaration);
  return (modifiers & ts.ModifierFlags.Export) !== 0;
}

function isDefineApiImport(
  node: ts.CallExpression,
  checker: ts.TypeChecker,
): string | undefined {
  if (!ts.isIdentifier(node.expression)) {
    return undefined;
  }

  const funcName = node.expression.text;
  if (!DEFINE_API_FUNCTIONS.has(funcName)) {
    return undefined;
  }

  const symbol = checker.getSymbolAtLocation(node.expression);
  if (!symbol) {
    return undefined;
  }

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return undefined;
  }

  const declaration = declarations[0];
  if (!declaration) {
    return undefined;
  }

  const sourceFile = declaration.getSourceFile();
  const fileName = sourceFile.fileName;

  if (
    fileName.includes(RUNTIME_PACKAGE) ||
    fileName.includes("@gqlkit-ts/runtime")
  ) {
    return funcName;
  }

  if (ts.isImportSpecifier(declaration)) {
    const importDecl = declaration.parent.parent.parent;
    if (ts.isImportDeclaration(importDecl)) {
      const moduleSpecifier = importDecl.moduleSpecifier;
      if (
        ts.isStringLiteral(moduleSpecifier) &&
        moduleSpecifier.text === RUNTIME_PACKAGE
      ) {
        return funcName;
      }
    }
  }

  return undefined;
}

function getResolverTypeFromFuncName(
  funcName: string,
): DefineApiResolverType | undefined {
  switch (funcName) {
    case "defineQuery":
      return "query";
    case "defineMutation":
      return "mutation";
    case "defineField":
      return "field";
    default:
      return undefined;
  }
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

    args.push({
      name: prop.getName(),
      tsType: convertTypeToTSTypeReference(propType, checker),
      optional,
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

        const funcName = isDefineApiImport(initializer, checker);
        if (!funcName) {
          continue;
        }

        const resolverType = getResolverTypeFromFuncName(funcName);
        if (!resolverType) {
          continue;
        }

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
            message: `Failed to extract type arguments from ${funcName} call for '${fieldName}'`,
            severity: "error",
            location: {
              file: filePath,
              line: line + 1,
              column: character + 1,
            },
          });
          continue;
        }

        resolvers.push({
          fieldName,
          resolverType,
          parentTypeName: typeInfo.parentTypeName,
          argsType: typeInfo.argsType,
          args: typeInfo.args,
          returnType: typeInfo.returnType,
          sourceFile: filePath,
          exportedInputTypes,
        });
      }
    });
  }

  return { resolvers, diagnostics };
}
