import ts from "typescript";
import type {
  Diagnostic,
  EnumMemberInfo,
  ExtractedTypeInfo,
  FieldDefinition,
  TSTypeReference,
  TypeKind,
  TypeMetadata,
} from "../types/index.js";

export interface ExtractionResult {
  readonly types: ReadonlyArray<ExtractedTypeInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  noEmit: true,
};

export function createProgramFromFiles(
  files: ReadonlyArray<string>,
): ts.Program {
  return ts.createProgram([...files], DEFAULT_COMPILER_OPTIONS);
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.getCombinedModifierFlags(node as ts.Declaration);
  return (modifiers & ts.ModifierFlags.Export) !== 0;
}

function isDefaultExport(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let hasDefaultExport = false;
  const nodeName = (node as ts.DeclarationStatement).name?.getText(sourceFile);

  ts.forEachChild(sourceFile, (child) => {
    if (
      ts.isExportAssignment(child) &&
      !child.isExportEquals &&
      ts.isIdentifier(child.expression)
    ) {
      if (child.expression.text === nodeName) {
        hasDefaultExport = true;
      }
    }
  });

  return hasDefaultExport;
}

function isBooleanUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false;
  const nonNullTypes = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );
  return (
    nonNullTypes.length === 2 &&
    nonNullTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
  );
}

function convertTsTypeToReference(
  type: ts.Type,
  checker: ts.TypeChecker,
): TSTypeReference {
  if (isBooleanUnion(type)) {
    const hasNull =
      type.isUnion() && type.types.some((t) => t.flags & ts.TypeFlags.Null);
    const hasUndefined =
      type.isUnion() &&
      type.types.some((t) => t.flags & ts.TypeFlags.Undefined);
    return {
      kind: "primitive",
      name: "boolean",
      nullable: hasNull || hasUndefined,
    };
  }

  if (type.isUnion()) {
    const nonNullTypes = type.types.filter(
      (t) =>
        !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
    );
    const hasNull = type.types.some((t) => t.flags & ts.TypeFlags.Null);
    const hasUndefined = type.types.some(
      (t) => t.flags & ts.TypeFlags.Undefined,
    );
    const nullable = hasNull || hasUndefined;

    if (nonNullTypes.length === 1) {
      const innerType = convertTsTypeToReference(nonNullTypes[0]!, checker);
      return { ...innerType, nullable };
    }

    return {
      kind: "union",
      members: nonNullTypes.map((t) => convertTsTypeToReference(t, checker)),
      nullable,
    };
  }

  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const elementType = typeArgs?.[0];
    return {
      kind: "array",
      elementType: elementType
        ? convertTsTypeToReference(elementType, checker)
        : { kind: "primitive", name: "unknown", nullable: false },
      nullable: false,
    };
  }

  const typeString = checker.typeToString(type);

  if (type.flags & ts.TypeFlags.String) {
    return { kind: "primitive", name: "string", nullable: false };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return { kind: "primitive", name: "number", nullable: false };
  }
  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return { kind: "primitive", name: "boolean", nullable: false };
  }
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return {
      kind: "literal",
      name: typeString.replace(/"/g, ""),
      nullable: false,
    };
  }
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    return { kind: "literal", name: typeString, nullable: false };
  }

  if (type.symbol) {
    return { kind: "reference", name: type.symbol.getName(), nullable: false };
  }

  return { kind: "reference", name: typeString, nullable: false };
}

function extractFieldsFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  const properties = type.getProperties();

  for (const prop of properties) {
    const propType = checker.getTypeOfSymbol(prop);
    const declarations = prop.getDeclarations();
    const declaration = declarations?.[0];

    let optional = false;
    if (declaration && ts.isPropertySignature(declaration)) {
      optional = declaration.questionToken !== undefined;
    }

    fields.push({
      name: prop.getName(),
      tsType: convertTsTypeToReference(propType, checker),
      optional,
    });
  }

  return fields;
}

export function isStringEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const members = node.members;
  if (members.length === 0) return false;

  return members.every((member) => {
    const initializer = member.initializer;
    return initializer !== undefined && ts.isStringLiteral(initializer);
  });
}

export function isNumericEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const members = node.members;
  if (members.length === 0) return true;

  return members.every((member) => {
    const initializer = member.initializer;
    if (initializer === undefined) return true;
    return (
      ts.isNumericLiteral(initializer) ||
      ts.isPrefixUnaryExpression(initializer)
    );
  });
}

export function isHeterogeneousEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const members = node.members;
  if (members.length <= 1) return false;

  let hasString = false;
  let hasNumeric = false;

  for (const member of members) {
    const initializer = member.initializer;
    if (initializer === undefined) {
      hasNumeric = true;
    } else if (ts.isStringLiteral(initializer)) {
      hasString = true;
    } else if (
      ts.isNumericLiteral(initializer) ||
      ts.isPrefixUnaryExpression(initializer)
    ) {
      hasNumeric = true;
    }

    if (hasString && hasNumeric) return true;
  }

  return false;
}

export function isConstEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const modifiers = ts.getCombinedModifierFlags(node);
  return (modifiers & ts.ModifierFlags.Const) !== 0;
}

export function isStringLiteralUnion(
  type: ts.Type,
  _checker: ts.TypeChecker,
): boolean {
  if (!type.isUnion()) return false;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );

  if (nonNullTypes.length === 0) return false;

  return nonNullTypes.every((t) => t.flags & ts.TypeFlags.StringLiteral);
}

function extractEnumMembers(
  node: ts.EnumDeclaration,
): ReadonlyArray<EnumMemberInfo> {
  const members: EnumMemberInfo[] = [];

  for (const member of node.members) {
    const name = member.name.getText();
    const initializer = member.initializer;
    if (initializer && ts.isStringLiteral(initializer)) {
      members.push({
        name,
        value: initializer.text,
      });
    }
  }

  return members;
}

function extractStringLiteralUnionMembers(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlyArray<EnumMemberInfo> {
  if (!type.isUnion()) return [];

  const members: EnumMemberInfo[] = [];

  for (const t of type.types) {
    if (t.flags & ts.TypeFlags.Null || t.flags & ts.TypeFlags.Undefined) {
      continue;
    }
    if (t.flags & ts.TypeFlags.StringLiteral) {
      const value = checker.typeToString(t).replace(/^"|"$/g, "");
      members.push({
        name: value,
        value: value,
      });
    }
  }

  return members;
}

function determineTypeKind(
  node: ts.Node,
  type: ts.Type,
  checker: ts.TypeChecker,
): TypeKind {
  if (ts.isInterfaceDeclaration(node)) {
    return "interface";
  }

  if (ts.isTypeAliasDeclaration(node)) {
    if (type.isUnion()) {
      const nonNullTypes = type.types.filter(
        (t) =>
          !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
      );

      if (isStringLiteralUnion(type, checker)) {
        return "enum";
      }

      const allObjectTypes = nonNullTypes.every(
        (t) => t.flags & ts.TypeFlags.Object || t.symbol !== undefined,
      );
      if (nonNullTypes.length > 1 && allObjectTypes) {
        return "union";
      }
    }
    return "object";
  }

  return "object";
}

function extractUnionMembers(type: ts.Type): string[] | undefined {
  if (!type.isUnion()) {
    return undefined;
  }

  const nonNullTypes = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );

  const allObjectTypes = nonNullTypes.every(
    (t) => t.flags & ts.TypeFlags.Object || t.symbol !== undefined,
  );

  if (nonNullTypes.length > 1 && allObjectTypes) {
    return nonNullTypes
      .map((t) => t.symbol?.getName() ?? "")
      .filter((name) => name !== "")
      .sort();
  }

  return undefined;
}

export function extractTypesFromProgram(
  program: ts.Program,
  sourceFiles: ReadonlyArray<string>,
): ExtractionResult {
  const checker = program.getTypeChecker();
  const types: ExtractedTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const filePath of sourceFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      diagnostics.push({
        code: "PARSE_ERROR",
        message: `Could not load source file: ${filePath}`,
        severity: "error",
        location: { file: filePath, line: 1, column: 1 },
      });
      continue;
    }

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isEnumDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          return;
        }

        const name = node.name.getText(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const location = {
          file: filePath,
          line: line + 1,
          column: character + 1,
        };

        if (isConstEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Const enum '${name}' is not supported. Use a regular enum instead.`,
            severity: "error",
            location,
          });
          return;
        }

        if (isHeterogeneousEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Heterogeneous enum '${name}' is not supported. Use a string enum instead.`,
            severity: "error",
            location,
          });
          return;
        }

        if (isNumericEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Numeric enum '${name}' is not supported. Use a string enum instead.`,
            severity: "error",
            location,
          });
          return;
        }

        const enumMembers = extractEnumMembers(node);
        const metadata: TypeMetadata = {
          name,
          kind: "enum",
          sourceFile: filePath,
          exportKind: hasDefaultExport ? "default" : "named",
        };

        types.push({ metadata, fields: [], enumMembers });
        return;
      }

      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          return;
        }

        const name = node.name.getText(sourceFile);

        if (node.typeParameters && node.typeParameters.length > 0) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          diagnostics.push({
            code: "UNSUPPORTED_SYNTAX",
            message: `Generic type '${name}' is not supported. Consider using a concrete type instead.`,
            severity: "warning",
            location: { file: filePath, line: line + 1, column: character + 1 },
          });
        }

        const symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol) {
          return;
        }

        const type = checker.getDeclaredTypeOfSymbol(symbol);
        const kind = determineTypeKind(node, type, checker);
        const unionMembers = extractUnionMembers(type);

        const metadata: TypeMetadata = {
          name,
          kind,
          sourceFile: filePath,
          exportKind: hasDefaultExport ? "default" : "named",
        };

        if (kind === "enum") {
          const enumMembers = extractStringLiteralUnionMembers(type, checker);
          types.push({ metadata, fields: [], enumMembers });
          return;
        }

        const fields =
          kind === "union" ? [] : extractFieldsFromType(type, checker);

        const typeInfo: ExtractedTypeInfo = unionMembers
          ? { metadata, fields, unionMembers }
          : { metadata, fields };

        types.push(typeInfo);
      }
    });
  }

  return { types, diagnostics };
}
