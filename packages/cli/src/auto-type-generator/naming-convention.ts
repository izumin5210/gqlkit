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
  readonly resolverType: "query" | "mutation" | "subscription" | "field";
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
  readonly resolverType: "query" | "mutation" | "subscription" | "field";
  readonly fieldName: string;
  readonly parentTypeName: string | null;
  readonly fieldPath: ReadonlyArray<string>;
}

const IRREGULAR_SINGULAR_FIELD_NAMES = new Map([
  ["aliases", "alias"],
  ["analyses", "analysis"],
  ["children", "child"],
  ["cookies", "cookie"],
  ["crises", "crisis"],
  ["diagnoses", "diagnosis"],
  ["feet", "foot"],
  ["geese", "goose"],
  ["men", "man"],
  ["mice", "mouse"],
  ["movies", "movie"],
  ["people", "person"],
  ["selfies", "selfie"],
  ["teeth", "tooth"],
  ["theses", "thesis"],
  ["women", "woman"],
  ["zombies", "zombie"],
]);

const NON_INFLECTING_FIELD_NAMES = new Set(["news", "series", "species"]);
const AMBIGUOUS_PLURAL_FIELD_NAMES = new Set(["axes"]);

/**
 * Convert a string to PascalCase.
 * Handles camelCase, snake_case, and kebab-case inputs.
 */
export function toPascalCase(str: string): string {
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

function isConsonant(char: string): boolean {
  return /^[bcdfghjklmnpqrstvwxyz]$/i.test(char);
}

function isUppercaseLetter(char: string): boolean {
  return char.toLowerCase() !== char && char.toUpperCase() === char;
}

function applyReplacementCase(params: {
  readonly replacement: string;
  readonly template: string;
}): string {
  const { replacement, template } = params;

  if (template.toUpperCase() === template) {
    return replacement.toUpperCase();
  }

  if (isUppercaseLetter(template.charAt(0))) {
    return `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`;
  }

  return replacement;
}

function singularizeIrregularFieldName(name: string): string | null {
  const lowerName = name.toLowerCase();

  for (const [plural, singular] of IRREGULAR_SINGULAR_FIELD_NAMES) {
    if (!lowerName.endsWith(plural)) {
      continue;
    }

    const suffixStart = name.length - plural.length;
    if (suffixStart > 0) {
      const previousChar = name.charAt(suffixStart - 1);
      const suffixFirstChar = name.charAt(suffixStart);
      const hasWordBoundary =
        previousChar === "_" ||
        previousChar === "-" ||
        isUppercaseLetter(suffixFirstChar);

      if (!hasWordBoundary) {
        continue;
      }
    }

    return `${name.slice(0, suffixStart)}${applyReplacementCase({
      replacement: singular,
      template: name.slice(suffixStart),
    })}`;
  }

  return null;
}

/**
 * Singularize a plural field name conservatively for array element type naming.
 * Falls back to the original name when the plural form is ambiguous.
 */
export function singularizeFieldName(name: string): string {
  const irregularSingular = singularizeIrregularFieldName(name);
  if (irregularSingular) {
    return irregularSingular;
  }

  const lowerName = name.toLowerCase();

  if (name.length <= 3 || NON_INFLECTING_FIELD_NAMES.has(lowerName)) {
    return name;
  }

  if (AMBIGUOUS_PLURAL_FIELD_NAMES.has(lowerName)) {
    return name;
  }

  if (lowerName.endsWith("ies")) {
    if (name.length <= 4) {
      return name.slice(0, -1);
    }

    if (isConsonant(lowerName.at(-4) ?? "")) {
      return `${name.slice(0, -3)}y`;
    }
  }

  if (
    lowerName.endsWith("sses") ||
    lowerName.endsWith("shes") ||
    lowerName.endsWith("ches") ||
    lowerName.endsWith("xes") ||
    lowerName.endsWith("zes")
  ) {
    return name.slice(0, -2);
  }

  if (lowerName.endsWith("uses")) {
    const candidate = name.slice(0, -2);
    if (candidate.toLowerCase().endsWith("us")) {
      return candidate;
    }
  }

  if (
    lowerName.endsWith("s") &&
    !lowerName.endsWith("ss") &&
    !lowerName.endsWith("is") &&
    !lowerName.endsWith("us")
  ) {
    return name.slice(0, -1);
  }

  return name;
}

interface AppendFieldPathParams {
  readonly parentPath: ReadonlyArray<string>;
  readonly fieldName: string;
  readonly singularize: boolean;
  readonly siblingFieldNames: ReadonlySet<string> | null;
}

function resolveFieldPathSegment(params: {
  readonly fieldName: string;
  readonly singularize: boolean;
  readonly siblingFieldNames: ReadonlySet<string> | null;
}): string {
  const { fieldName, singularize, siblingFieldNames } = params;

  if (!singularize) {
    return fieldName;
  }

  const singularFieldName = singularizeFieldName(fieldName);
  if (
    singularFieldName !== fieldName &&
    siblingFieldNames?.has(singularFieldName)
  ) {
    return fieldName;
  }

  return singularFieldName;
}

/**
 * Append a field name to an auto-type field path.
 */
export function appendFieldPath(params: AppendFieldPathParams): string[] {
  const { parentPath, fieldName, singularize, siblingFieldNames } = params;
  return [
    ...parentPath,
    resolveFieldPathSegment({ fieldName, singularize, siblingFieldNames }),
  ];
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
