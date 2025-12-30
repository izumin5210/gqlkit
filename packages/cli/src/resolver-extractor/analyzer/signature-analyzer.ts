import ts from "typescript";
import type {
  Diagnostic,
  TSTypeReference,
} from "../../type-extractor/types/index.js";
import type {
  ExtractedResolvers,
  ResolverPair,
} from "../extractor/resolver-extractor.js";

export interface ArgumentDefinition {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly optional: boolean;
}

export interface AnalyzedField {
  readonly name: string;
  readonly parentType?: TSTypeReference;
  readonly args?: ReadonlyArray<ArgumentDefinition>;
  readonly returnType: TSTypeReference;
}

export interface AnalyzedResolver {
  readonly pair: ResolverPair;
  readonly fields: ReadonlyArray<AnalyzedField>;
}

export interface AnalyzedResolvers {
  readonly resolvers: ReadonlyArray<AnalyzedResolver>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
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

function isPromiseType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const symbol = type.symbol ?? type.aliasSymbol;
  if (!symbol) return false;

  const name = checker.getFullyQualifiedName(symbol);
  return name === "Promise";
}

function unwrapPromise(type: ts.Type, checker: ts.TypeChecker): ts.Type {
  if (!isPromiseType(type, checker)) {
    return type;
  }

  const typeRef = type as ts.TypeReference;
  const typeArgs = typeRef.typeArguments ?? checker.getTypeArguments(typeRef);
  if (typeArgs && typeArgs.length > 0) {
    return typeArgs[0]!;
  }
  return type;
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
      tsType: convertTsTypeToReference(propType, checker),
      optional,
    });
  }

  return args;
}

function analyzeResolverFields(
  pair: ResolverPair,
  checker: ts.TypeChecker,
  diagnostics: Diagnostic[],
): AnalyzedField[] {
  const fields: AnalyzedField[] = [];
  const type = checker.getDeclaredTypeOfSymbol(pair.typeSymbol);
  const properties = type.getProperties();
  const isRootResolver =
    pair.category === "query" || pair.category === "mutation";

  for (const prop of properties) {
    const propType = checker.getTypeOfSymbol(prop);
    const fieldName = prop.getName();

    const callSignatures = propType.getCallSignatures();
    if (callSignatures.length === 0) {
      diagnostics.push({
        code: "INVALID_RESOLVER_SIGNATURE",
        message: `Field '${fieldName}' in '${pair.typeName}' is not a function`,
        severity: "error",
        location: {
          file: pair.sourceFile,
          line: 1,
          column: 1,
        },
      });
      continue;
    }

    const signature = callSignatures[0]!;
    const parameters = signature.getParameters();
    let rawReturnType = signature.getReturnType();
    rawReturnType = unwrapPromise(rawReturnType, checker);
    const returnType = convertTsTypeToReference(rawReturnType, checker);

    let parentType: TSTypeReference | undefined;
    let args: ArgumentDefinition[] | undefined;

    if (isRootResolver) {
      if (parameters.length > 0) {
        const argsParam = parameters[0]!;
        const argsType = checker.getTypeOfSymbol(argsParam);
        args = extractArgsFromType(argsType, checker);
      }
    } else {
      if (parameters.length > 0) {
        const parentParam = parameters[0]!;
        const parentTypeTs = checker.getTypeOfSymbol(parentParam);
        parentType = convertTsTypeToReference(parentTypeTs, checker);

        if (parentType.name !== pair.targetTypeName) {
          diagnostics.push({
            code: "PARENT_TYPE_MISMATCH",
            message: `Field '${fieldName}' in '${pair.typeName}' has parent type '${parentType.name}' but expected '${pair.targetTypeName}'`,
            severity: "error",
            location: {
              file: pair.sourceFile,
              line: 1,
              column: 1,
            },
          });
        }
      }

      if (parameters.length > 1) {
        const argsParam = parameters[1]!;
        const argsType = checker.getTypeOfSymbol(argsParam);
        args = extractArgsFromType(argsType, checker);
      }
    }

    fields.push({
      name: fieldName,
      parentType,
      args: args && args.length > 0 ? args : undefined,
      returnType,
    });
  }

  return fields;
}

export function analyzeSignatures(
  extractedResolvers: ExtractedResolvers,
  checker: ts.TypeChecker,
): AnalyzedResolvers {
  const resolvers: AnalyzedResolver[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const pair of extractedResolvers.resolvers) {
    const fields = analyzeResolverFields(pair, checker, diagnostics);
    resolvers.push({ pair, fields });
  }

  return { resolvers, diagnostics };
}
