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

/**
 * Returns the source location if present, otherwise creates a default location
 * with the given source file and line/column 1.
 */
export function getSourceLocationOrDefault(
  location: SourceLocation | null,
  sourceFile: string,
): SourceLocation {
  return location ?? { file: sourceFile, line: 1, column: 1 };
}
