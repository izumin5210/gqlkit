import { toPascalCase } from "./naming-convention.js";

export interface GenerateDiscriminatorMemberNameParams {
  readonly unionTypeName: string;
  readonly values: ReadonlyArray<string | null>;
}

/**
 * Generates a member type name for an inline union member based on discriminator field values.
 * Each non-null value is converted to PascalCase and appended to the union type name.
 * Null values (fields absent from the member) are skipped.
 */
export function generateDiscriminatorMemberName(
  params: GenerateDiscriminatorMemberNameParams,
): string {
  const { unionTypeName, values } = params;

  const suffix = values
    .filter((v): v is string => v !== null)
    .map(toPascalCase)
    .join("");

  return `${unionTypeName}${suffix}`;
}
