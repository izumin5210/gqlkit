import { BUILT_IN_SCALARS, type Diagnostic } from "../../core/index.js";
import type {
  GraphQLFieldDefinition,
  MutationFieldDefinitions,
  QueryFieldDefinitions,
  SubscriptionFieldDefinitions,
  TypeExtension,
} from "../types.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export interface ValidateResolverTypesOptions {
  readonly queryFields: QueryFieldDefinitions;
  readonly mutationFields: MutationFieldDefinitions;
  readonly subscriptionFields: SubscriptionFieldDefinitions;
  readonly typeExtensions: ReadonlyArray<TypeExtension>;
  /** Names of types already extracted from `GqlObject`/`GqlInterface`/etc. declarations (type-extractor's stage). */
  readonly declaredTypeNames: ReadonlyArray<string>;
  /** Custom scalar names, both config-declared and auto-detected. */
  readonly customScalarNames: ReadonlyArray<string>;
  /**
   * Every top-level type alias / interface / enum name declared in the
   * scanned source files, exported or not (see
   * `collectLocalTypeDeclarationNames`). A resolver return/arg type that
   * resolves to one of these is a real TypeScript declaration — just not one
   * registered as a schema type (issue #343) — and must not be flagged.
   */
  readonly localTypeDeclarationNames: ReadonlySet<string>;
}

// Placeholder tokens `resolveFieldType`/`convertTsTypeToGraphQLType` emit for
// inline (not-yet-named) shapes. These are resolved to real, auto-generated
// type names later by auto-type-generator, which runs after this validation
// — mirrors type-validator.ts's own PLACEHOLDER_TYPES exemption.
const PLACEHOLDER_TYPES = new Set([
  "__INLINE_OBJECT__",
  "__INLINE_ENUM__",
  "__INLINE_UNION__",
  "__NEVER__",
]);

/**
 * Validates that resolver return types and argument types reference only
 * names within the same resolution universe the rest of the pipeline
 * accepts (refactor-plan.md §6 Decision D6): declared/extracted schema
 * types, built-in and custom scalars, inline-type placeholders, and any
 * real local type declaration (whether or not it's registered as a schema
 * type — see `localTypeDeclarationNames`).
 *
 * This is `type-extractor/validator/type-validator.ts`'s pattern applied to
 * `ExtractResolversResult`: declared-type fields already get this coverage;
 * resolver args/return types previously got none, so a typo'd or forgotten
 * type name would silently produce a dangling reference (e.g. `role:
 * NonExistentRole!`) or, worse, collapse to a bare `any!` return type,
 * instead of failing generation.
 */
export function validateResolverTypes(
  options: ValidateResolverTypesOptions,
): ValidationResult {
  const {
    queryFields,
    mutationFields,
    subscriptionFields,
    typeExtensions,
    declaredTypeNames,
    customScalarNames,
    localTypeDeclarationNames,
  } = options;

  const knownNames = new Set([
    ...declaredTypeNames,
    ...BUILT_IN_SCALARS,
    ...customScalarNames,
    ...localTypeDeclarationNames,
  ]);

  function isKnown(typeName: string): boolean {
    return knownNames.has(typeName) || PLACEHOLDER_TYPES.has(typeName);
  }

  const diagnostics: Diagnostic[] = [];

  function checkField(field: GraphQLFieldDefinition): void {
    const returnTypeName = field.type.typeName;
    if (!isKnown(returnTypeName)) {
      diagnostics.push({
        code: "UNSUPPORTED_RETURN_TYPE",
        message: `Field '${field.name}' returns unresolved type '${returnTypeName}'`,
        severity: "error",
        location: field.sourceLocation,
      });
    }

    if (!field.args) {
      return;
    }
    for (const arg of field.args) {
      const argTypeName = arg.type.typeName;
      if (!isKnown(argTypeName)) {
        diagnostics.push({
          code: "UNKNOWN_ARGUMENT_TYPE",
          message: `Argument '${arg.name}' of field '${field.name}' references unresolved type '${argTypeName}'`,
          severity: "error",
          location: field.sourceLocation,
        });
      }
    }
  }

  for (const field of queryFields.fields) {
    checkField(field);
  }
  for (const field of mutationFields.fields) {
    checkField(field);
  }
  for (const field of subscriptionFields.fields) {
    checkField(field);
  }
  for (const typeExtension of typeExtensions) {
    for (const field of typeExtension.fields) {
      checkField(field);
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}
