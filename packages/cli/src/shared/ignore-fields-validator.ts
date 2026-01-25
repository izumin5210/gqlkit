/**
 * IgnoreFields validator.
 *
 * This module provides validation functions for ignoreFields metadata,
 * checking that specified field names exist in the type and that not
 * all fields are excluded.
 */

import type {
  Diagnostic,
  SourceLocation,
} from "../type-extractor/types/diagnostics.js";

/**
 * Parameters for validateIgnoreFields function.
 */
export interface ValidateIgnoreFieldsParams {
  readonly typeName: string;
  readonly ignoreFields: ReadonlySet<string>;
  readonly allFieldNames: ReadonlySet<string>;
  readonly sourceLocation: SourceLocation;
}

/**
 * Validates ignoreFields metadata.
 *
 * This function checks:
 * 1. All field names in ignoreFields exist in the type
 * 2. Not all fields are excluded (at least one field must remain)
 *
 * @param params - The validation parameters
 * @returns Array of diagnostics (empty if valid)
 */
export function validateIgnoreFields(
  params: ValidateIgnoreFieldsParams,
): ReadonlyArray<Diagnostic> {
  const { typeName, ignoreFields, allFieldNames, sourceLocation } = params;
  const diagnostics: Diagnostic[] = [];

  for (const fieldName of ignoreFields) {
    if (!allFieldNames.has(fieldName)) {
      const availableFields = [...allFieldNames].sort().join(", ");
      diagnostics.push({
        code: "IGNORE_FIELD_NOT_FOUND",
        message: `Type '${typeName}': ignoreFields contains unknown field '${fieldName}'. Available fields: ${availableFields}`,
        severity: "error",
        location: sourceLocation,
      });
    }
  }

  const remainingFieldCount = [...allFieldNames].filter(
    (f) => !ignoreFields.has(f),
  ).length;

  if (remainingFieldCount === 0 && allFieldNames.size > 0) {
    diagnostics.push({
      code: "IGNORE_ALL_FIELDS",
      message: `Type '${typeName}': ignoreFields excludes all fields. At least one field must remain.`,
      severity: "error",
      location: sourceLocation,
    });
  }

  return diagnostics;
}
