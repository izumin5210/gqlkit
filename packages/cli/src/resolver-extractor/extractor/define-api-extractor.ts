import type { ConstValueNode } from "graphql";
import ts from "typescript";
import { parseDefaultValue } from "../../shared/default-value-parser.js";
import {
  detectScalarMetadata,
  getActualMetadataType,
} from "../../shared/metadata-detector.js";
import {
  type DeprecationInfo,
  extractTSDocFromSymbol,
  extractTSDocInfo,
  type TSDocInfo,
} from "../../shared/tsdoc-parser.js";
import type {
  Diagnostic,
  SourceLocation,
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
  readonly defaultValue: ConstValueNode | null;
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

function convertTypeToTSTypeReference(
  type: ts.Type,
  checker: ts.TypeChecker,
): TSTypeReference {
  const metadataResult = detectScalarMetadata(type, checker);
  if (metadataResult.scalarName && !metadataResult.isPrimitive) {
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
      return {
        kind: "union",
        name: null,
        elementType: null,
        members: nonNullTypes.map((t) =>
          convertTypeToTSTypeReference(t, checker),
        ),
        nullable,
        scalarInfo: null,
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
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
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
    };
  }

  return {
    kind: "reference",
    name: typeString,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: null,
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
): TSDocInfo {
  const declarations = prop.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return { description: null, deprecated: null, defaultValue: null };
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

interface ExtractArgsResult {
  readonly args: ArgumentDefinition[];
  readonly diagnostics: Diagnostic[];
}

function extractArgsFromType(
  argsType: ts.Type,
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  filePath: string,
): ExtractArgsResult {
  const args: ArgumentDefinition[] = [];
  const diagnostics: Diagnostic[] = [];
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

    let defaultValue: ConstValueNode | null = null;
    if (tsdocInfo.defaultValue) {
      let location: SourceLocation = { file: filePath, line: 1, column: 1 };
      if (declaration) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          declaration.getStart(sourceFile),
        );
        location = { file: filePath, line: line + 1, column: character + 1 };
      }
      const parseResult = parseDefaultValue(
        tsdocInfo.defaultValue.rawValue,
        location,
      );
      if (parseResult.value) {
        defaultValue = parseResult.value;
      }
      if (parseResult.diagnostic) {
        diagnostics.push(parseResult.diagnostic);
      }
    }

    args.push({
      name: prop.getName(),
      tsType: convertTypeToTSTypeReference(propType, checker),
      optional,
      description: tsdocInfo.description,
      deprecated: tsdocInfo.deprecated,
      defaultValue,
    });
  }

  return { args, diagnostics };
}

interface ExtractTypeArgumentsResult {
  parentTypeName: string | null;
  argsType: TSTypeReference | null;
  args: ArgumentDefinition[] | null;
  returnType: TSTypeReference;
  diagnostics: Diagnostic[];
}

function extractTypeArgumentsFromCall(
  node: ts.CallExpression,
  checker: ts.TypeChecker,
  resolverType: DefineApiResolverType,
  sourceFile: ts.SourceFile,
  filePath: string,
): ExtractTypeArgumentsResult | null {
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

    const argsResult = isNoArgs
      ? null
      : extractArgsFromType(argsType, checker, sourceFile, filePath);

    return {
      parentTypeName: parentTypeName ?? null,
      argsType: isNoArgs ? null : argsTypeRef,
      args: argsResult && argsResult.args.length > 0 ? argsResult.args : null,
      returnType: convertTypeToTSTypeReference(returnType, checker),
      diagnostics: argsResult?.diagnostics ?? [],
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

  const argsResult = isNoArgs
    ? null
    : extractArgsFromType(argsType, checker, sourceFile, filePath);

  return {
    parentTypeName: null,
    argsType: isNoArgs ? null : argsTypeRef,
    args: argsResult && argsResult.args.length > 0 ? argsResult.args : null,
    returnType: convertTypeToTSTypeReference(returnType, checker),
    diagnostics: argsResult?.diagnostics ?? [],
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
          sourceFile,
          filePath,
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

        diagnostics.push(...typeInfo.diagnostics);

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
