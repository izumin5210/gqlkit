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
 * Result of ignoreFields validation.
 */
export interface ValidateIgnoreFieldsResult {
  readonly isValid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

/**
 * Validates ignoreFields metadata.
 *
 * This function checks:
 * 1. All field names in ignoreFields exist in the type
 * 2. Not all fields are excluded (at least one field must remain)
 *
 * @param params - The validation parameters
 * @returns Validation result with isValid flag and any diagnostics
 */
export function validateIgnoreFields(
  params: ValidateIgnoreFieldsParams,
): ValidateIgnoreFieldsResult {
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

  const existingIgnoreFields = [...ignoreFields].filter((f) =>
    allFieldNames.has(f),
  );
  const remainingFieldCount = allFieldNames.size - existingIgnoreFields.length;

  if (remainingFieldCount === 0 && allFieldNames.size > 0) {
    diagnostics.push({
      code: "IGNORE_ALL_FIELDS",
      message: `Type '${typeName}': ignoreFields excludes all fields. At least one field must remain.`,
      severity: "error",
      location: sourceLocation,
    });
  }

  return {
    isValid: diagnostics.length === 0,
    diagnostics,
  };
}
