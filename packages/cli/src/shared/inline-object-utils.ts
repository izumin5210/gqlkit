import ts from "typescript";

/**
 * Checks if a TypeScript type is an inline object type (anonymous type literal).
 * Returns true for types like `{ foo: string; bar: number }` but not for named types.
 */
export function isInlineObjectType(type: ts.Type): boolean {
  if (type.aliasSymbol) {
    return false;
  }
  if (!type.symbol) {
    return false;
  }
  const symbolName = type.symbol.getName();
  if (symbolName !== "__type") {
    return false;
  }
  if (!(type.flags & ts.TypeFlags.Object)) {
    return false;
  }
  const objectType = type as ts.ObjectType;
  return (objectType.objectFlags & ts.ObjectFlags.Anonymous) !== 0;
}
