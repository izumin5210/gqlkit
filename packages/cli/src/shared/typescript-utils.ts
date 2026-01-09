import ts from "typescript";

/**
 * Checks if a type represents null or undefined.
 */
export function isNullOrUndefined(type: ts.Type): boolean {
  return (
    (type.flags & ts.TypeFlags.Null) !== 0 ||
    (type.flags & ts.TypeFlags.Undefined) !== 0
  );
}

/**
 * Checks if a union type contains null or undefined.
 */
export function isNullableUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false;
  return type.types.some((t) => isNullOrUndefined(t));
}

/**
 * Gets non-nullable types from a union type.
 */
export function getNonNullableTypes(type: ts.Type): ts.Type[] {
  if (!type.isUnion()) return [type];
  return type.types.filter((t) => !isNullOrUndefined(t));
}

/**
 * Extracts nullability information from a type.
 */
export function extractNullability(type: ts.Type): {
  nullable: boolean;
  nonNullableTypes: ts.Type[];
} {
  if (!type.isUnion()) {
    return { nullable: false, nonNullableTypes: [type] };
  }

  const nonNullableTypes = getNonNullableTypes(type);
  const nullable = nonNullableTypes.length < type.types.length;

  return { nullable, nonNullableTypes };
}
