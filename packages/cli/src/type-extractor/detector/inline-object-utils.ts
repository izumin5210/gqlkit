import * as ts from "../../core/typescript.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";

/**
 * Checks if a TypeScript type is an inline object type (anonymous type literal).
 * Returns true for types like `{ foo: string; bar: number }` but not for named types.
 */
export async function isInlineObjectType(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<boolean> {
  if (await checker.getAliasSymbolOfType(type)) {
    return false;
  }
  const symbol = await checker.getSymbolOfType(type);
  if (!symbol) {
    return false;
  }
  const symbolName = symbol.name;
  if (symbolName !== "__type" && symbolName !== "__object") {
    return false;
  }
  if (!(type.flags & ts.TypeFlags.Object)) {
    return false;
  }
  const objectType = type as ts.ObjectType;
  return (objectType.objectFlags & ts.ObjectFlags.Anonymous) !== 0;
}
