/**
 * OnlyValidator validates that scalar types with only constraints
 * are used in the correct position (input or output).
 *
 * - Scalars with only: "output" can only be used in output positions
 * - Scalars with only: "input" can only be used in input positions
 * - Scalars without only constraint can be used in both positions
 */

import type { TSTypeReference } from "../../type-extractor/types/index.js";

export type OnlyConstraintViolationCode =
  | "OUTPUT_ONLY_IN_INPUT_POSITION"
  | "INPUT_ONLY_IN_OUTPUT_POSITION";

export interface OnlyConstraintViolation {
  readonly code: OnlyConstraintViolationCode;
  readonly message: string;
  readonly scalarName: string;
  readonly only: "input" | "output";
  readonly position: "input" | "output";
  readonly context: ValidationContext;
}

interface InputTypeFieldContext {
  readonly kind: "inputTypeField";
  readonly typeName: string;
  readonly fieldName: string;
  readonly sourceFile: string;
  readonly line: number;
}

interface ObjectTypeFieldContext {
  readonly kind: "objectTypeField";
  readonly typeName: string;
  readonly fieldName: string;
  readonly sourceFile: string;
  readonly line: number;
}

interface ResolverArgumentContext {
  readonly kind: "resolverArgument";
  readonly resolverName: string;
  readonly argumentName: string;
  readonly sourceFile: string;
  readonly line: number;
}

interface ResolverReturnTypeContext {
  readonly kind: "resolverReturnType";
  readonly resolverName: string;
  readonly sourceFile: string;
  readonly line: number;
}

export type ValidationContext =
  | InputTypeFieldContext
  | ObjectTypeFieldContext
  | ResolverArgumentContext
  | ResolverReturnTypeContext;

export interface ValidateOnlyConstraintsOptions {
  readonly typeRef: TSTypeReference;
  readonly position: "input" | "output";
  readonly context: ValidationContext;
}

function formatContextLocation(context: ValidationContext): string {
  switch (context.kind) {
    case "inputTypeField":
      return `field '${context.fieldName}' of input type '${context.typeName}'`;
    case "objectTypeField":
      return `field '${context.fieldName}' of type '${context.typeName}'`;
    case "resolverArgument":
      return `argument '${context.argumentName}' of resolver '${context.resolverName}'`;
    case "resolverReturnType":
      return `return type of resolver '${context.resolverName}'`;
  }
}

function createViolationMessage(
  scalarName: string,
  only: "input" | "output",
  position: "input" | "output",
  context: ValidationContext,
): string {
  const locationDesc = formatContextLocation(context);
  const oppositePosition = only === "output" ? "input" : "output";
  const hint =
    position === "input"
      ? "Use a type without 'only' constraint or with 'only: \"input\"' instead."
      : "Use a type without 'only' constraint or with 'only: \"output\"' instead.";

  return `Scalar type '${scalarName}' is ${only}-only but is used in ${position} position (${locationDesc}). ${oppositePosition.charAt(0).toUpperCase() + oppositePosition.slice(1)}-only scalars cannot be used in ${position} positions. ${hint}`;
}

function collectScalarViolations(
  typeRef: TSTypeReference,
  position: "input" | "output",
  context: ValidationContext,
  violations: OnlyConstraintViolation[],
): void {
  if (typeRef.scalarInfo) {
    const { scalarName, only } = typeRef.scalarInfo;

    if (only !== null) {
      if (position === "input" && only === "output") {
        violations.push({
          code: "OUTPUT_ONLY_IN_INPUT_POSITION",
          message: createViolationMessage(scalarName, only, position, context),
          scalarName,
          only,
          position,
          context,
        });
      } else if (position === "output" && only === "input") {
        violations.push({
          code: "INPUT_ONLY_IN_OUTPUT_POSITION",
          message: createViolationMessage(scalarName, only, position, context),
          scalarName,
          only,
          position,
          context,
        });
      }
    }
  }

  if (typeRef.elementType) {
    collectScalarViolations(typeRef.elementType, position, context, violations);
  }

  if (typeRef.members) {
    for (const member of typeRef.members) {
      collectScalarViolations(member, position, context, violations);
    }
  }
}

/**
 * Validates that only constraints are not violated.
 * Returns diagnostics for each violation.
 *
 * @param options - Validation options including type reference, position, and context
 * @returns Array of constraint violations (empty if no violations)
 */
export function validateOnlyConstraints(
  options: ValidateOnlyConstraintsOptions,
): ReadonlyArray<OnlyConstraintViolation> {
  const violations: OnlyConstraintViolation[] = [];
  collectScalarViolations(
    options.typeRef,
    options.position,
    options.context,
    violations,
  );
  return violations;
}
