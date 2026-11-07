/**
 * Answers `getDocumentationComment` from the syntax tree when that is all
 * the checker would read.
 *
 * Every documentation lookup is a request carrying the symbol, and nearly
 * every declared type and property needs one, mostly to learn that there is
 * none. The checker renders a declaration's last JSDoc comment, and only
 * consults types to inherit documentation for undocumented members of
 * classes and interfaces with base types, or for parameters, overloads and
 * binding elements. This port of that logic covers declarations in files the
 * client already has and returns `null` whenever the checker would have to
 * look further, so the caller asks the checker instead.
 */

import {
  type Declaration,
  type InterfaceDeclaration,
  type JSDoc,
  type Node,
  SyntaxKind,
  type VariableDeclarationList,
} from "typescript/ast";
import type { NodeHandle, Symbol as TsSymbol } from "typescript/async";

export interface LocalDocumentationContext {
  /** Whether the client already has the file at `path`. */
  readonly isLoadedFile: (path: string) => boolean;
  readonly resolveHandle: (
    handle: NodeHandle<Declaration>,
  ) => Promise<Declaration | undefined>;
  readonly getSymbolAtLocation: (node: Node) => Promise<TsSymbol | undefined>;
}

/** A JSDoc comment, none (`undefined`), or one the checker must find. */
type JSDocLookup = JSDoc | undefined | "checker";

const FUNCTION_LIKE_DECLARATION_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.MethodSignature,
  SyntaxKind.Constructor,
  SyntaxKind.ConstructSignature,
]);

/**
 * Whether every declaration of the interface symbol is an interface without
 * `extends` clauses, i.e. the interface has no base types to inherit
 * documentation from.
 */
async function hasNoBaseTypes(
  ctx: LocalDocumentationContext,
  declaration: InterfaceDeclaration,
): Promise<boolean> {
  const symbol = await ctx.getSymbolAtLocation(declaration.name);
  if (symbol === undefined) {
    return false;
  }
  const handles = symbol.declarations;
  if (
    handles.some(
      (h) =>
        h.kind !== SyntaxKind.InterfaceDeclaration || !ctx.isLoadedFile(h.path),
    )
  ) {
    return false;
  }
  const declarations = await Promise.all(handles.map(ctx.resolveHandle));
  return declarations.every(
    (d) =>
      d !== undefined &&
      ((d as InterfaceDeclaration).heritageClauses?.length ?? 0) === 0,
  );
}

async function findJSDoc(
  ctx: LocalDocumentationContext,
  node: Node,
): Promise<JSDocLookup> {
  const own = node.jsDoc?.at(-1);
  if (own !== undefined) {
    return own as JSDoc;
  }
  const parent = node.parent;
  switch (node.kind) {
    case SyntaxKind.Parameter:
    case SyntaxKind.TypeParameter:
    case SyntaxKind.BindingElement:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.ArrowFunction:
    case SyntaxKind.ClassExpression:
      return "checker";
    case SyntaxKind.VariableDeclaration:
      if (
        parent?.kind === SyntaxKind.VariableDeclarationList &&
        (parent as VariableDeclarationList).declarations[0] === node
      ) {
        // The comment of `export const x = ...` sits on the statement,
        // which has no symbol of its own to inherit from.
        return parent.parent?.jsDoc?.at(-1) as JSDoc | undefined;
      }
      break;
  }
  if (parent === undefined) {
    return undefined;
  }
  if (FUNCTION_LIKE_DECLARATION_KINDS.has(node.kind)) {
    return "checker";
  }
  switch (parent.kind) {
    case SyntaxKind.ClassDeclaration:
    case SyntaxKind.ClassExpression:
      return "checker";
    case SyntaxKind.InterfaceDeclaration:
      return (await hasNoBaseTypes(ctx, parent as InterfaceDeclaration))
        ? undefined
        : "checker";
    default:
      return undefined;
  }
}

/** The plain text of one declaration's documentation, or `null`. */
async function documentationOfDeclaration(
  ctx: LocalDocumentationContext,
  declaration: Declaration,
): Promise<string | null> {
  const jsDoc = await findJSDoc(ctx, declaration);
  if (jsDoc === "checker") {
    return null;
  }
  if (jsDoc === undefined) {
    return "";
  }
  if (
    jsDoc.tags?.some(
      (tag) =>
        tag.kind === SyntaxKind.JSDocTypedefTag ||
        tag.kind === SyntaxKind.JSDocCallbackTag,
    )
  ) {
    return null;
  }
  let text = "";
  for (const part of jsDoc.comment ?? []) {
    // Links render with the names they resolve to.
    if (part.kind !== SyntaxKind.JSDocText) {
      return null;
    }
    text += part.text;
  }
  return text;
}

/**
 * The symbol's documentation as the checker renders it, or `null` if the
 * checker has to be asked.
 */
export async function getLocalDocumentationComment(
  ctx: LocalDocumentationContext,
  symbol: TsSymbol,
): Promise<string | null> {
  const handles = symbol.declarations;
  if (handles.some((h) => !ctx.isLoadedFile(h.path))) {
    return null;
  }
  const declarations = await Promise.all(handles.map(ctx.resolveHandle));
  const parts: string[] = [];
  const seen = new Set<Declaration>();
  for (const declaration of declarations) {
    if (declaration === undefined) {
      return null;
    }
    if (seen.has(declaration)) {
      continue;
    }
    seen.add(declaration);
    const doc = await documentationOfDeclaration(ctx, declaration);
    if (doc === null) {
      return null;
    }
    if (doc !== "" && !parts.includes(doc)) {
      parts.push(doc);
    }
  }
  return parts.join("\n");
}
