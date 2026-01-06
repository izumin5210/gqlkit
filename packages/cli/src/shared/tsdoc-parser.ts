import ts from "typescript";

export interface DeprecationInfo {
  readonly isDeprecated: true;
  readonly reason: string | null;
}

export interface DefaultValueInfo {
  readonly rawValue: string;
}

export interface TSDocInfo {
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly defaultValue: DefaultValueInfo | null;
}

function getSymbolFromNode(
  node: ts.Node,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    return checker.getSymbolAtLocation(node.name);
  }
  if (ts.isEnumDeclaration(node)) {
    return checker.getSymbolAtLocation(node.name);
  }
  if (ts.isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0];
    if (declaration && ts.isIdentifier(declaration.name)) {
      return checker.getSymbolAtLocation(declaration.name);
    }
  }
  return undefined;
}

function getTagCommentText(
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
): string | undefined {
  if (typeof comment === "string") {
    const trimmed = comment.replace(/\r\n/g, "\n").trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (Array.isArray(comment)) {
    const text = comment
      .map((part) => part.text)
      .join("")
      .replace(/\r\n/g, "\n")
      .trim();
    return text === "" ? undefined : text;
  }
  return undefined;
}

function extractDescriptionTagContent(
  declarations: ReadonlyArray<ts.Declaration> | undefined,
): string | undefined {
  if (!declarations) {
    return undefined;
  }

  for (const declaration of declarations) {
    const jsdocTags = ts.getJSDocTags(declaration);
    for (const tag of jsdocTags) {
      if (tag.tagName.text === "description") {
        return getTagCommentText(tag.comment);
      }
    }
  }

  return undefined;
}

function extractDeprecatedFromDeclarations(
  declarations: ReadonlyArray<ts.Declaration> | undefined,
): DeprecationInfo | undefined {
  if (!declarations) {
    return undefined;
  }

  for (const declaration of declarations) {
    const jsdocTags = ts.getJSDocTags(declaration);
    for (const tag of jsdocTags) {
      if (tag.tagName.text === "deprecated") {
        const reason = getTagCommentText(tag.comment);
        return {
          isDeprecated: true,
          reason: reason ?? null,
        };
      }
    }
  }

  return undefined;
}

function extractDefaultValueFromDeclarations(
  declarations: ReadonlyArray<ts.Declaration> | undefined,
): DefaultValueInfo | undefined {
  if (!declarations) {
    return undefined;
  }

  for (const declaration of declarations) {
    const jsdocTags = ts.getJSDocTags(declaration);
    for (const tag of jsdocTags) {
      if (tag.tagName.text === "defaultValue") {
        const rawValue = getTagCommentText(tag.comment);
        return {
          rawValue: rawValue ?? "",
        };
      }
    }
  }

  return undefined;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function extractDescriptionFromSymbol(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): string | undefined {
  const documentationComment = symbol.getDocumentationComment(checker);

  if (documentationComment.length > 0) {
    const description = normalizeLineEndings(
      ts.displayPartsToString(documentationComment).trim(),
    );
    if (description !== "") {
      return description;
    }
  }

  const descriptionTagContent = extractDescriptionTagContent(
    symbol.getDeclarations(),
  );
  if (descriptionTagContent) {
    return normalizeLineEndings(descriptionTagContent);
  }

  return undefined;
}

export function extractTSDocInfo(
  node: ts.Node,
  checker: ts.TypeChecker,
): TSDocInfo {
  const symbol = getSymbolFromNode(node, checker);

  if (!symbol) {
    return { description: null, deprecated: null, defaultValue: null };
  }

  const declarations = symbol.getDeclarations();
  const description = extractDescriptionFromSymbol(symbol, checker);
  const deprecated = extractDeprecatedFromDeclarations(declarations);
  const defaultValue = extractDefaultValueFromDeclarations(declarations);

  return {
    description: description ?? null,
    deprecated: deprecated ?? null,
    defaultValue: defaultValue ?? null,
  };
}

export function extractTSDocFromSymbol(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): TSDocInfo {
  const declarations = symbol.getDeclarations();
  const description = extractDescriptionFromSymbol(symbol, checker);
  const deprecated = extractDeprecatedFromDeclarations(declarations);
  const defaultValue = extractDefaultValueFromDeclarations(declarations);

  return {
    description: description ?? null,
    deprecated: deprecated ?? null,
    defaultValue: defaultValue ?? null,
  };
}
