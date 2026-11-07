import type { DeprecationInfo } from "../core/index.js";
import * as ts from "../core/typescript.js";
import type { CheckerLoader } from "./checker-loader.js";
import { getDeclarations } from "./typescript-utils.js";

export interface TSDocInfo {
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

async function getSymbolFromNode(
  node: ts.Node,
  checker: CheckerLoader,
): Promise<ts.Symbol | undefined> {
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
  comment: ts.NodeArray<ts.JSDocComment> | undefined,
): string | undefined {
  if (comment === undefined) {
    return undefined;
  }
  const text = comment
    .map((part) => part.text)
    .join("")
    .replace(/\r\n/g, "\n")
    .trim();
  return text === "" ? undefined : text;
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

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

async function extractDescriptionFromSymbol(
  symbol: ts.Symbol,
  checker: CheckerLoader,
): Promise<string | undefined> {
  const documentationComment = await checker.getDocumentationComment(symbol);

  if (documentationComment.length > 0) {
    const description = normalizeLineEndings(documentationComment.trim());
    if (description !== "") {
      return description;
    }
  }

  const descriptionTagContent = extractDescriptionTagContent(
    await getDeclarations(symbol),
  );
  if (descriptionTagContent) {
    return normalizeLineEndings(descriptionTagContent);
  }

  return undefined;
}

export async function extractTsDocInfo(
  node: ts.Node,
  checker: CheckerLoader,
): Promise<TSDocInfo> {
  const symbol = await getSymbolFromNode(node, checker);

  if (!symbol) {
    return { description: null, deprecated: null };
  }

  const description = await extractDescriptionFromSymbol(symbol, checker);
  const deprecated = extractDeprecatedFromDeclarations(
    await getDeclarations(symbol),
  );

  return {
    description: description ?? null,
    deprecated: deprecated ?? null,
  };
}

export async function extractTsDocFromSymbol(
  symbol: ts.Symbol,
  checker: CheckerLoader,
): Promise<TSDocInfo> {
  const description = await extractDescriptionFromSymbol(symbol, checker);
  const deprecated = extractDeprecatedFromDeclarations(
    await getDeclarations(symbol),
  );

  return {
    description: description ?? null,
    deprecated: deprecated ?? null,
  };
}
