/**
 * Context for generating auto type names based on different scenarios.
 */
export type AutoTypeNameContext =
  | ObjectFieldContext
  | InputFieldContext
  | ResolverArgContext
  | ResolverPayloadContext;

/**
 * Context for Object type field inline objects.
 * Generated name: {ParentTypeName}{PascalCaseFieldPath}
 */
export interface ObjectFieldContext {
  readonly kind: "objectField";
  readonly parentTypeName: string;
  readonly fieldPath: ReadonlyArray<string>;
}

/**
 * Context for Input type field inline objects.
 * Generated name: {ParentTypeNameWithoutInputSuffix}{PascalCaseFieldPath}Input
 */
export interface InputFieldContext {
  readonly kind: "inputField";
  readonly parentTypeName: string;
  readonly fieldPath: ReadonlyArray<string>;
}

/**
 * Context for resolver argument inline objects.
 * Query/Mutation: {PascalCaseFieldName}{PascalCaseArgName}{NestedPath}Input
 * Field resolver: {ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}{NestedPath}Input
 */
export interface ResolverArgContext {
  readonly kind: "resolverArg";
  readonly resolverType: "query" | "mutation" | "field";
  readonly fieldName: string;
  readonly argName: string;
  readonly parentTypeName: string | null;
  readonly fieldPath: ReadonlyArray<string>;
}

/**
 * Context for resolver payload inline types.
 * Query/Mutation: {PascalCaseFieldName}Payload
 * Field resolver: {ParentTypeName}{PascalCaseFieldName}Payload
 * Nested: {PayloadTypeName}{PascalCaseFieldPath} (no Input suffix)
 */
export interface ResolverPayloadContext {
  readonly kind: "resolverPayload";
  readonly resolverType: "query" | "mutation" | "field";
  readonly fieldName: string;
  readonly parentTypeName: string | null;
  readonly fieldPath: ReadonlyArray<string>;
}

/**
 * Convert a string to PascalCase.
 * Handles camelCase, snake_case, and kebab-case inputs.
 */
function toPascalCase(str: string): string {
  if (str.length === 0) return str;

  return str
    .split(/[-_\s]+/)
    .map((part) =>
      part
        .split(/(?=[A-Z])/)
        .map(
          (segment) =>
            segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
        )
        .join(""),
    )
    .join("");
}

/**
 * Remove Input suffix from type name if present.
 */
function removeInputSuffix(typeName: string): string {
  if (typeName.endsWith("Input")) {
    return typeName.slice(0, -5);
  }
  return typeName;
}

/**
 * Check if a type name follows the Input type naming convention.
 */
export function isInputTypeName(name: string): boolean {
  return name.endsWith("Input");
}

/**
 * Build a field context (object or input) based on the parent type name.
 */
export function buildFieldContext(
  parentTypeName: string,
  fieldPath: ReadonlyArray<string>,
  isInput: boolean,
): ObjectFieldContext | InputFieldContext {
  return isInput
    ? { kind: "inputField", parentTypeName, fieldPath }
    : { kind: "objectField", parentTypeName, fieldPath };
}

/**
 * Generate auto type name based on context.
 */
export function generateAutoTypeName(context: AutoTypeNameContext): string {
  switch (context.kind) {
    case "objectField":
      return generateObjectFieldTypeName(context);
    case "inputField":
      return generateInputFieldTypeName(context);
    case "resolverArg":
      return generateResolverArgTypeName(context);
    case "resolverPayload":
      return generateResolverPayloadTypeName(context);
  }
}

function generateObjectFieldTypeName(context: ObjectFieldContext): string {
  const pathParts = context.fieldPath.map(toPascalCase).join("");
  return `${context.parentTypeName}${pathParts}`;
}

function generateInputFieldTypeName(context: InputFieldContext): string {
  const baseName = removeInputSuffix(context.parentTypeName);
  const pathParts = context.fieldPath.map(toPascalCase).join("");
  return `${baseName}${pathParts}Input`;
}

function generateResolverArgTypeName(context: ResolverArgContext): string {
  const fieldNamePascal = toPascalCase(context.fieldName);
  // Avoid "InputInput" duplication when argName is "input"
  const argNamePascal =
    context.argName.toLowerCase() === "input"
      ? ""
      : toPascalCase(context.argName);
  const pathParts = context.fieldPath.map(toPascalCase).join("");

  if (context.resolverType === "field" && context.parentTypeName) {
    return `${context.parentTypeName}${fieldNamePascal}${argNamePascal}${pathParts}Input`;
  }

  return `${fieldNamePascal}${argNamePascal}${pathParts}Input`;
}

function generateResolverPayloadTypeName(
  context: ResolverPayloadContext,
): string {
  const fieldNamePascal = toPascalCase(context.fieldName);
  const pathParts = context.fieldPath.map(toPascalCase).join("");

  if (context.resolverType === "field" && context.parentTypeName) {
    return `${context.parentTypeName}${fieldNamePascal}Payload${pathParts}`;
  }

  return `${fieldNamePascal}Payload${pathParts}`;
}
