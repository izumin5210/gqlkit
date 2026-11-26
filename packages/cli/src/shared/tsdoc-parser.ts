import {
  type Declaration,
  getJSDocTags,
  type JSDocComment,
  type Node,
  type NodeArray,
  SyntaxKind,
  type TypeNode,
} from "typescript/ast";
import {
  isEnumDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isLiteralTypeNode,
  isStringLiteral,
  isTypeAliasDeclaration,
  isUnionTypeNode,
  isVariableStatement,
} from "typescript/ast/is";
import {
  getLeadingCommentRanges,
  getTrailingCommentRanges,
} from "typescript/ast/scanner";
import type { Symbol as TsSymbol } from "typescript/async";
import type { DeprecationInfo } from "../core/index.js";
import type { CheckerLoader } from "./checker-loader.js";

export interface TSDocInfo {
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
}

async function getSymbolFromNode(
  node: Node,
  checker: CheckerLoader,
): Promise<TsSymbol | undefined> {
  if (isInterfaceDeclaration(node) || isTypeAliasDeclaration(node)) {
    return checker.getSymbolAtLocation(node.name);
  }
  if (isEnumDeclaration(node)) {
    return checker.getSymbolAtLocation(node.name);
  }
  if (isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0];
    if (declaration && isIdentifier(declaration.name)) {
      return checker.getSymbolAtLocation(declaration.name);
    }
  }
  return undefined;
}

function getTagCommentText(
  comment: NodeArray<JSDocComment> | undefined,
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
  declarations: ReadonlyArray<Declaration> | undefined,
): string | undefined {
  if (!declarations) {
    return undefined;
  }

  for (const declaration of declarations) {
    const jsdocTags = getJSDocTags(declaration);
    for (const tag of jsdocTags) {
      if (tag.tagName.text === "description") {
        return getTagCommentText(tag.comment);
      }
    }
  }

  return undefined;
}

function extractDeprecatedFromDeclarations(
  declarations: ReadonlyArray<Declaration> | undefined,
): DeprecationInfo | undefined {
  if (!declarations) {
    return undefined;
  }

  for (const declaration of declarations) {
    const jsdocTags = getJSDocTags(declaration);
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
  symbol: TsSymbol,
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
    await checker.getDeclarationsOfSymbol(symbol),
  );
  if (descriptionTagContent) {
    return normalizeLineEndings(descriptionTagContent);
  }

  return undefined;
}

export async function extractTsDocInfo(
  node: Node,
  checker: CheckerLoader,
): Promise<TSDocInfo> {
  const symbol = await getSymbolFromNode(node, checker);

  if (!symbol) {
    return { description: null, deprecated: null };
  }

  const description = await extractDescriptionFromSymbol(symbol, checker);
  const deprecated = extractDeprecatedFromDeclarations(
    await checker.getDeclarationsOfSymbol(symbol),
  );

  return {
    description: description ?? null,
    deprecated: deprecated ?? null,
  };
}

export async function extractTsDocFromSymbol(
  symbol: TsSymbol,
  checker: CheckerLoader,
): Promise<TSDocInfo> {
  const description = await extractDescriptionFromSymbol(symbol, checker);
  const deprecated = extractDeprecatedFromDeclarations(
    await checker.getDeclarationsOfSymbol(symbol),
  );

  return {
    description: description ?? null,
    deprecated: deprecated ?? null,
  };
}

interface ParsedTag {
  readonly name: string;
  readonly lines: string[];
}

function joinCommentLines(lines: ReadonlyArray<string>): string | null {
  const text = lines
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return text === "" ? null : text;
}

/**
 * Parses the body of a `/** ... *\/` comment (without the delimiters) the way
 * the TypeScript JSDoc parser reads declarations: the main comment runs until
 * the first line that starts with a tag, and a tag's comment runs until the
 * next tag.
 */
function parseTsDocCommentBody(body: string): TSDocInfo {
  const mainLines: string[] = [];
  const tags: ParsedTag[] = [];

  for (const rawLine of normalizeLineEndings(body).split("\n")) {
    const line = rawLine.replace(/^\s*\*? ?/, "");
    const tagMatch = /^\s*@(\w+)(.*)$/.exec(line);
    if (tagMatch) {
      tags.push({ name: tagMatch[1]!, lines: [tagMatch[2]!] });
    } else if (tags.length > 0) {
      tags[tags.length - 1]!.lines.push(line);
    } else {
      mainLines.push(line);
    }
  }

  const descriptionTag = tags.find((tag) => tag.name === "description");
  const deprecatedTag = tags.find((tag) => tag.name === "deprecated");

  return {
    description:
      joinCommentLines(mainLines) ??
      (descriptionTag ? joinCommentLines(descriptionTag.lines) : null),
    deprecated: deprecatedTag
      ? { isDeprecated: true, reason: joinCommentLines(deprecatedTag.lines) }
      : null,
  };
}

/**
 * Reads the closest `/** ... *\/` comment in the trivia before `node`.
 * The TypeScript parser attaches JSDoc only to declarations, so comments on
 * type nodes such as union members are not reachable through `getJSDocTags`.
 * A comment on the same line as the preceding token (`| /** doc *\/ "A"`) is
 * scanned as a trailing comment of that token, so both kinds are read, as
 * TypeScript itself does for parameters.
 */
function extractTsDocFromPrecedingComment(node: Node): TSDocInfo | null {
  const text = node.getSourceFile().text;
  const jsDocRange = [
    ...(getTrailingCommentRanges(text, node.pos) ?? []),
    ...(getLeadingCommentRanges(text, node.pos) ?? []),
  ]
    .filter(
      (range) =>
        range.kind === SyntaxKind.MultiLineCommentTrivia &&
        text.startsWith("/**", range.pos) &&
        // `/**/` is an empty block comment, not JSDoc
        range.end - range.pos > 4,
    )
    .at(-1);
  if (!jsDocRange) {
    return null;
  }
  return parseTsDocCommentBody(
    text.slice(jsDocRange.pos + 3, jsDocRange.end - 2),
  );
}

/**
 * Collects TSDoc written before string literal members of a union type node,
 * keyed by the literal value. Members that do not appear as literals in this
 * node (e.g. ones that come from another alias) have no entry.
 */
export function extractStringLiteralUnionMemberTsDoc(
  typeNode: TypeNode | null,
): ReadonlyMap<string, TSDocInfo> {
  const result = new Map<string, TSDocInfo>();
  if (typeNode === null || !isUnionTypeNode(typeNode)) {
    return result;
  }
  for (const member of typeNode.types) {
    if (!isLiteralTypeNode(member) || !isStringLiteral(member.literal)) {
      continue;
    }
    const tsdocInfo = extractTsDocFromPrecedingComment(member);
    if (tsdocInfo && !result.has(member.literal.text)) {
      result.set(member.literal.text, tsdocInfo);
    }
  }
  return result;
}
