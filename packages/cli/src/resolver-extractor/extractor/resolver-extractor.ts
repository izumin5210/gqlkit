import ts from "typescript";
import type { Diagnostic } from "../../type-extractor/types/index.js";

export type ResolverCategory = "query" | "mutation" | "type";

export interface ResolverPair {
  readonly typeName: string;
  readonly valueName: string;
  readonly category: ResolverCategory;
  readonly targetTypeName: string;
  readonly typeSymbol: ts.Symbol;
  readonly valueSymbol: ts.Symbol;
  readonly sourceFile: string;
}

export interface ExtractedResolvers {
  readonly resolvers: ReadonlyArray<ResolverPair>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const RESOLVER_SUFFIX = "Resolver";

function isExported(node: ts.Node): boolean {
  const modifiers = ts.getCombinedModifierFlags(node as ts.Declaration);
  return (modifiers & ts.ModifierFlags.Export) !== 0;
}

function getResolverCategory(typeName: string): ResolverCategory {
  if (typeName === "QueryResolver") {
    return "query";
  }
  if (typeName === "MutationResolver") {
    return "mutation";
  }
  return "type";
}

function getTargetTypeName(typeName: string): string {
  if (typeName === "QueryResolver") {
    return "Query";
  }
  if (typeName === "MutationResolver") {
    return "Mutation";
  }
  return typeName.slice(0, -RESOLVER_SUFFIX.length);
}

function toValueName(typeName: string): string {
  return typeName.charAt(0).toLowerCase() + typeName.slice(1);
}

interface ResolverTypeInfo {
  readonly name: string;
  readonly symbol: ts.Symbol;
  readonly node: ts.Node;
}

interface ResolverValueInfo {
  readonly name: string;
  readonly symbol: ts.Symbol;
  readonly node: ts.Node;
}

function extractResolverTypesFromSourceFile(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ResolverTypeInfo[] {
  const resolverTypes: ResolverTypeInfo[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      if (!isExported(node)) {
        return;
      }

      const name = node.name.getText(sourceFile);
      if (!name.endsWith(RESOLVER_SUFFIX)) {
        return;
      }

      const symbol = checker.getSymbolAtLocation(node.name);
      if (!symbol) {
        return;
      }

      resolverTypes.push({ name, symbol, node });
    }
  });

  return resolverTypes;
}

function extractResolverValuesFromSourceFile(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ResolverValueInfo[] {
  const resolverValues: ResolverValueInfo[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      if (!isExported(node)) {
        return;
      }

      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }

        const name = declaration.name.getText(sourceFile);
        if (!name.endsWith(RESOLVER_SUFFIX)) {
          continue;
        }

        const symbol = checker.getSymbolAtLocation(declaration.name);
        if (!symbol) {
          continue;
        }

        resolverValues.push({ name, symbol, node: declaration });
      }
    }
  });

  return resolverValues;
}

export function extractResolversFromProgram(
  program: ts.Program,
  files: ReadonlyArray<string>,
): ExtractedResolvers {
  const checker = program.getTypeChecker();
  const resolvers: ResolverPair[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const filePath of files) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      continue;
    }

    const resolverTypes = extractResolverTypesFromSourceFile(
      sourceFile,
      checker,
    );
    const resolverValues = extractResolverValuesFromSourceFile(
      sourceFile,
      checker,
    );

    const valueNameMap = new Map<string, ResolverValueInfo>();
    for (const value of resolverValues) {
      valueNameMap.set(value.name, value);
    }

    const typeNameMap = new Map<string, ResolverTypeInfo>();
    for (const type of resolverTypes) {
      typeNameMap.set(type.name, type);
    }

    for (const resolverType of resolverTypes) {
      const expectedValueName = toValueName(resolverType.name);
      const matchingValue = valueNameMap.get(expectedValueName);

      if (!matchingValue) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          (resolverType.node as ts.DeclarationStatement).name?.getStart(
            sourceFile,
          ) ?? resolverType.node.getStart(sourceFile),
        );
        diagnostics.push({
          code: "MISSING_RESOLVER_VALUE",
          message: `Resolver type '${resolverType.name}' is missing its corresponding value '${expectedValueName}'`,
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
        typeName: resolverType.name,
        valueName: matchingValue.name,
        category: getResolverCategory(resolverType.name),
        targetTypeName: getTargetTypeName(resolverType.name),
        typeSymbol: resolverType.symbol,
        valueSymbol: matchingValue.symbol,
        sourceFile: filePath,
      });
    }

    for (const resolverValue of resolverValues) {
      const expectedTypeName =
        resolverValue.name.charAt(0).toUpperCase() +
        resolverValue.name.slice(1);
      const matchingType = typeNameMap.get(expectedTypeName);

      if (!matchingType) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          (resolverValue.node as ts.VariableDeclaration).name?.getStart(
            sourceFile,
          ) ?? resolverValue.node.getStart(sourceFile),
        );
        diagnostics.push({
          code: "MISSING_RESOLVER_TYPE",
          message: `Resolver value '${resolverValue.name}' is missing its corresponding type '${expectedTypeName}'`,
          severity: "error",
          location: {
            file: filePath,
            line: line + 1,
            column: character + 1,
          },
        });
      }
    }
  }

  return { resolvers, diagnostics };
}
