import type ts from "typescript";

export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

/**
 * Extracts source location from a TypeScript AST node.
 */
export function getSourceLocationFromNode(
  node: ts.Node | undefined,
): SourceLocation | null {
  if (!node) return null;

  const sourceFile = node.getSourceFile();
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );

  return {
    file: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
  };
}
